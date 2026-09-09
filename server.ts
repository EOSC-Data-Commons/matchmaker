import compression from "compression";
import express from "express";
import rateLimit from "express-rate-limit";
import morgan from "morgan";
import path from "path";
import {createProxyMiddleware} from "http-proxy-middleware";
import {createRequestHandler} from "@react-router/express";

import {
    fetchDatasetFilesFromDatahuggerByUrl,
    fileMetaToFileEntry,
    getDataplayerClient,
    getToolSrcClient,
    grpcErrorToHttpStatus,
    launchTool,
    GetArtifactRequest,
    GetToolRequest,
    MatchToolsByDataRequest,
    MonitorStateRequest,
    MonitorStateResponse,
    SearchToolsByTextRequest,
    ToolState_State,
    GrpcSlotToSlot,
    mapToolKindToTyp,
} from "./src/lib/server/grpcClient";

import {signPreviewUrl, verifyPreviewUrl} from "./src/lib/server/previewSigning";
import {isSafePublicUrl, resolvesToPublicAddress} from "./src/lib/server/previewUrlGuard";

import type {
    ApiKeysResponse,
    FileMeta,
    TaskState,
    TaskStatus,
    ToolConfig,
    TypLaunchToolRequest
} from "./src/types/dataplayerTypes";

// Constants
const DEVELOPMENT = process.env.NODE_ENV !== "production";
const PORT = Number.parseInt(
    process.env.PORT || (DEVELOPMENT ? "5173" : "3000"),
);
const SEARCH_API_URL = process.env.SEARCH_API_URL || "http://127.0.0.1:8000";
// FAIR assessment proxy (dans-labs/fair-assessment-proxy). Not hosted yet, so this
// points at the local docker-compose stack; set FAIR_API_URL once it is deployed.
const FAIR_API_URL = process.env.FAIR_API_URL || "http://127.0.0.1:8080";

// Express parses `?x=a&x=b` into an array and `?x[y]=a` into an object, so a
// query value is only a string once we have checked that it is. Everything else
// is treated as absent rather than coerced, so no downstream code can be handed
// something whose `.slice`/`.indexOf` mean something different than we assume.
function queryString(value: unknown): string | undefined {
    return typeof value === "string" ? value : undefined;
}

function getEgiToken(req: express.Request): string {
    const cookieHeader = req.headers.cookie ?? "";
    for (const part of cookieHeader.split(";")) {
        const [name, ...rest] = part.trim().split("=");
        if (name.trim() === "access_token") {
            return decodeURIComponent(rest.join("="));
        }
    }
    throw new Error("EGI access_token cookie not found — user may not be authenticated");
}

const app = express();

app.disable("x-powered-by");

// Proxies
app.use(
    "/api/search",
    createProxyMiddleware({
        target: SEARCH_API_URL,
        changeOrigin: true,
        pathRewrite: {"^/api/search": ""},
        on: {
            proxyRes: (proxyRes) => {
                // The MCP backend (FastMCP/Starlette) redirects /mcp -> /mcp/ with an
                // absolute Location pointing at its internal host (e.g. http://mcp:8000/mcp/).
                // Strip the origin and re-add the /api/search prefix so the redirect stays
                // behind the proxy and is reachable by the client.
                const location = proxyRes.headers.location;
                if (location) {
                    const relative = location.replace(/^https?:\/\/[^/]+/, '');
                    if (relative.startsWith('/')) {
                        proxyRes.headers.location = '/api/search' + relative;
                    }
                }
            }, error: (err, _req, res) => {
                console.error("Search API proxy error:", err);
                (res as express.Response).status(500).send("Proxy error");
            },
        },
    }),
);

// Auth + per-user API keys (EGI Secret Store), e.g. /auth/user, /auth/login, /auth/keys/*.
// Registered before `express.json()` so request bodies (e.g. PUT /auth/keys/:id) stream
// through to the backend intact — the body parser would otherwise drain the stream.
app.use(
    "/auth",
    createProxyMiddleware({
        target: SEARCH_API_URL,
        changeOrigin: false,
        pathRewrite: {"^/": "/auth/"},
        on: {
            error: (err, _req, res) => {
                console.error("Auth API proxy error:", err);
                (res as express.Response).status(500).send("Proxy error");
            },
        },
    }),
);

// FAIR assessment proxy. Registered before `express.json()` for the same reason as
// `/auth`: the body parser would drain the request stream and POST /assessments
// would hang with no body ever reaching the service.
//
// Same-origin keeps the browser out of CORS entirely. The service does send
// `Access-Control-Allow-Origin: *`, so calling it directly works in dev, but that
// stops being true the moment it is hosted somewhere other than localhost.
app.use(
    "/api/fair",
    createProxyMiddleware({
        target: FAIR_API_URL,
        changeOrigin: true,
        // `app.use` has already stripped the "/api/fair" mount prefix by the time the
        // middleware runs, so the rewrite matches "^/" and prepends the service's own
        // prefix — the same shape as the "/auth" proxy above. Matching "^/api/fair"
        // here would never fire and every request would reach the service unprefixed.
        pathRewrite: {"^/": "/api/v1/"},
        on: {
            error: (err, _req, res) => {
                console.error("FAIR API proxy error:", err);
                (res as express.Response).status(500).send("Proxy error");
            },
        },
    }),
);

// TODO: rename to task/start
app.use(express.json());
app.post("/api/coordinator/start-task", async (req, res) => {
    // console.debug("headers:", req.headers);
    // console.debug("body:", req.body);
    // TODO: compile time type safety through a type/api.ts to share type info with client.
    // this can prevent the parsing typos etc.
    //
    // XXX: @reggie can I assume the unique id of tool in the tool registry is a valid UUID?
    const {
        userInfo,
        toolId,
        datasetUrl,
        datasetTitle,
        slotMapping,
        files,
    } = req.body as TypLaunchToolRequest;

    try {
        const raw_token = getEgiToken(req);

        // if the secret store is unreachable or the route isn't deployed yet, launch the task
        // without keys instead of failing the whole request.
        let keys: Record<string, string> = {};
        try {
            const response = await fetch(`${SEARCH_API_URL}/auth/keys/all`, {
                method: "GET",
                headers: {
                    Cookie: `access_token=${raw_token}`,
                    "Content-Type": "application/json",
                },
            });

            if (!response.ok) {
                throw new Error(`Failed to fetch API keys (${response.status})`);
            }

            const data: ApiKeysResponse = await response.json();
            keys = data.keys ?? {};
        } catch (err) {
            console.warn("Skipping API keys for this task - secret store unavailable:", err instanceof Error ? err.message : err);
        }

        const file_entries = Object.fromEntries(
            Object.entries(files).filter(([, file]) => !file.isDir).map(([key, file]) => [key, fileMetaToFileEntry(file)])
        );
        const taskId = await launchTool(
            userInfo,
            toolId,
            datasetUrl,
            datasetTitle,
            slotMapping,
            file_entries,
            keys,
            raw_token,
        );

        if (!taskId) {
            return res.status(500).json({error: "No task_id returned"});
        }

        // 3️⃣ Return task ID for SSE tracking
        res.json(taskId);
    } catch (err) {
        console.error(err);
        res.status(500).json({
            error: err instanceof Error ? err.message : String(err),
        });
    }
});

// TODO: rename to task/status/:taskId
app.get("/api/coordinator/task-status/:taskId", async (req, res) => {
    // TODO: token or session cookie to prevent access from anywhere.

    const {taskId} = req.params;

    // SSE headers
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    // XXX: per user connection as well, so the token or the user name need to be an argument passed in
    const client = getDataplayerClient();
    const grpc_req: MonitorStateRequest = {
        id: taskId,
    };
    const stream = client.monitorState(grpc_req);
    let lastState: ToolState_State | null = null;

    req.on("close", () => {
        stream.cancel();
        res.end();
    });

    stream.on("data", (resp: MonitorStateResponse) => {
        // when state machine transit to the end state.
        const toolState = resp.status;
        const currentState = toolState?.state ?? null;

        // Stream progress
        if (currentState !== null && currentState !== lastState) {
            lastState = currentState;

            let stateStr: TaskState = "UNKNOWN";
            switch (currentState) {
                case ToolState_State.PREPARING:
                    stateStr = "PREPARING";
                    break;
                case ToolState_State.READY:
                    stateStr = "READY";
                    break;
                case ToolState_State.DROPPED:
                    stateStr = "DROPPED";
                    break;
                case ToolState_State.EXCEPTION:
                    stateStr = "EXCEPTION";
                    break;
                default:
                    stateStr = "UNKNOWN";
                    break;
            }

            const payload: TaskStatus = {
                state: stateStr,
                message: toolState?.log ?? "",
            };

            res.write(`event: state\ndata: ${
                JSON.stringify(payload)
            }\n\n`);
        }
    });

    stream.on("end", () => {
        res.end();
    });
});

// TODO: rename to task/result/:taskId
app.use(express.json());
app.get("/api/coordinator/tasks-result/:taskId", async (req, res) => {
    const {taskId} = req.params;
    const client = getDataplayerClient();
    try {
        const grpc_req: GetArtifactRequest = {
            handlerId: taskId,
        };
        let v_callbackUrl: string | null = null;

        client.getArtifact(grpc_req, (err, response) => {
            if (err) {
                console.error(err);
                res.status(grpcErrorToHttpStatus(err)).json({error: err.message || String(err)});
                return;
            }
            let callbackUrl: string | undefined;

            if (response.eoscInline) {
                callbackUrl = response.eoscInline.callbackUrl;
            } else if (response.hosted) {
                callbackUrl = response.hosted.callbackUrl;
            } else {
                console.error("No entry_point found");
                res.status(404).json({error: "No entry_point found"});
                return;
            }
            v_callbackUrl = callbackUrl;
            res.send(v_callbackUrl);
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({error: err instanceof Error ? err.message : String(err)});
    }
});

app.use(express.json());
app.post("/api/coordinator/tool/match", async (req, res) => {
    const client = getToolSrcClient();
    try {
        // XXX: @reggie here is the abstract interface to the tool registry.
        const {files} = req.body as { files: FileMeta[] };
        const grpc_req: MatchToolsByDataRequest = {
            files: files
                .filter(f => !f.isDir)
                .map(f => (fileMetaToFileEntry(f))),
        };

        client.matchToolsByData(grpc_req, (err, response) => {
            if (err) {
                console.error(err);
                res.status(grpcErrorToHttpStatus(err)).json({error: err.message || String(err)});
                return;
            }

            const foundTools: Record<string, ToolConfig> = {};
            for (const tool of response.tools) {
                const config: ToolConfig = {
                    name: tool.name,
                    description: tool.description,
                    slots: tool.slots.map(GrpcSlotToSlot),
                    typ: mapToolKindToTyp(tool.kind),
                };

                foundTools[tool.id] = config;
            }
            res.json(foundTools);
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({error: err instanceof Error ? err.message : String(err)});
    }
});

app.use(express.json());
app.get("/api/coordinator/tool/search", async (req, res) => {
    const client = getToolSrcClient();
    try {
        const query = queryString(req.query.q) || "";
        const grpc_req: SearchToolsByTextRequest = {
            text: query,
        };

        client.searchToolsByText(grpc_req, (err, response) => {
            if (err) {
                console.error(err);
                res.status(grpcErrorToHttpStatus(err)).json({error: err.message || String(err)});
                return;
            }

            const foundTools: Record<string, ToolConfig> = {};
            for (const tool of response.tools) {
                const config: ToolConfig = {
                    name: tool.name,
                    description: tool.description,
                    slots: tool.slots.map(GrpcSlotToSlot),
                    typ: mapToolKindToTyp(tool.kind),
                };

                foundTools[tool.id] = config;
            }
            res.json(foundTools);
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({error: err instanceof Error ? err.message : String(err)});
    }
});

app.use(express.json());
app.get("/api/coordinator/tool/get/:toolId", async (req, res) => {
    const {toolId: id} = req.params;
    const client = getToolSrcClient();
    try {
        // XXX: @reggie here is the abstract interface to the tool registry.
        const grpc_req: GetToolRequest = {
            id,
        };

        client.getTool(grpc_req, (err, response) => {
            if (err) {
                console.error(err);
                res.status(grpcErrorToHttpStatus(err)).json({error: err.message || String(err)});
                return;
            }

            const tool = response.tool;
            if (!tool) {
                console.error("not a valid tool");
                res.status(404).json({error: "not a valid tool"});
                return;
            }

            const config: ToolConfig = {
                name: tool.name,
                description: tool.description,
                slots: tool.slots.map(GrpcSlotToSlot),
                typ: mapToolKindToTyp(tool.kind),
            };
            console.warn(config);

            res.json(config);
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({error: err instanceof Error ? err.message : String(err)});
    }
});

app.get("/api/coordinator/files", async (req, res) => {
    const handle = queryString(req.query.handle);
    if (!handle) {
        return res.status(400).json({error: "Missing handle parameter"});
    }

    // TODO: cache entry, inmemory from start, and maybe move to use redis in production.

    try {
        const token = getEgiToken(req);
        // XXX: where error goes if url is invalid?? Should we give this to user??
        const files = await fetchDatasetFilesFromDatahuggerByUrl(handle, token);
        // SSRF guard for the preview proxy: sign every download URL we emit so
        // the proxy can later prove a URL came from us, without holding state
        // that a sibling pm2 worker would not see.
        for (const file of files) {
            if (file.downloadUrl) file.previewSig = signPreviewUrl(file.downloadUrl);
        }
        res.json(files);
    } catch (err) {
        console.error("Error fetching files:", err);
        res.status(500).json({error: "Failed to fetch files"});
    }
});

// Streams a (capped) preview of a remote datafile back to the browser so the
// client never talks to the external repository host directly — this avoids CORS
// and lets us bound how many bytes we pull. `mode=text` fetches only the first
// chunk; binary mode (pdf/images) passes bytes through with Range support.
const PREVIEW_TEXT_MAX_BYTES = 64 * 1024;
const PREVIEW_BINARY_MAX_BYTES = 25 * 1024 * 1024;

/** The target resolved somewhere we refuse to connect to; reported as a 403. */
class BlockedTargetError extends Error {
}

// This route is unauthenticated and makes an outbound request to a third party
// on every call, so an abusive caller spends the server's reputation with the
// repository rather than their own — Zenodo throttles by source IP, and every
// preview leaves from ours. The allowance is deliberately roomy: the browser's
// PDF viewer fires a burst of Range requests for a single document.
//
// NOTE: keyed on `req.ip`. Behind a reverse proxy, that is the proxy's address
// unless Express is told to trust it, which would put every user in one bucket.
// See the file-preview section in AGENTS.md before deploying behind one.
const previewRateLimit = rateLimit({
    windowMs: 60_000,
    limit: 100,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: {error: "Too many preview requests, try again shortly"},
});

// Follow redirects ourselves so each hop's target is re-validated — a repository
// may legitimately redirect a download to CDN/object storage, but we must never
// follow a 3xx into an internal host.
async function fetchPreviewUpstream(
    startUrl: string,
    headers: Record<string, string>,
    maxRedirects = 5,
): Promise<Response> {
    let current = startUrl;
    for (let hop = 0; hop <= maxRedirects; hop++) {
        // Every hop, including the first: the signature says we issued this URL,
        // not that it points anywhere safe, and a hostname only reveals where it
        // really goes once resolved.
        if (!isSafePublicUrl(current) || !(await resolvesToPublicAddress(new URL(current).hostname))) {
            throw new BlockedTargetError(`Preview blocked: ${current} is not a public host`);
        }

        const resp = await fetch(current, {headers, redirect: "manual"});
        if (resp.status < 300 || resp.status >= 400) return resp;

        const location = resp.headers.get("location");
        if (!location) return resp;

        current = new URL(location, current).toString();
    }
    throw new Error("Preview exceeded maximum redirects");
}

app.get("/api/coordinator/file-preview", previewRateLimit, async (req, res) => {
    const rawUrl = queryString(req.query.url);
    const mode = queryString(req.query.mode) === "text" ? "text" : "binary";
    const signature = queryString(req.query.sig);

    // Primary control: only fetch URLs the server itself emitted from /files,
    // proven by the signature it attached there. This is what prevents request
    // forgery — the URL is not trusted from the user.
    if (!rawUrl || !isSafePublicUrl(rawUrl)) {
        return res.status(403).json({error: "URL not permitted for preview"});
    }
    const signatureCheck = verifyPreviewUrl(rawUrl, signature);
    if (signatureCheck === "expired") {
        return res.status(410).json({error: "Preview link expired"});
    }
    if (signatureCheck !== "ok") {
        return res.status(403).json({error: "URL not permitted for preview"});
    }

    try {
        const upstreamHeaders: Record<string, string> = {};
        if (mode === "text") {
            upstreamHeaders["Range"] = `bytes=0-${PREVIEW_TEXT_MAX_BYTES - 1}`;
        } else if (req.headers.range) {
            // let the browser's PDF viewer seek
            upstreamHeaders["Range"] = req.headers.range as string;
        }

        const upstream = await fetchPreviewUpstream(rawUrl, upstreamHeaders);
        if (!upstream.ok && upstream.status !== 206) {
            return res.status(upstream.status).json({error: `Upstream returned ${upstream.status}`});
        }

        if (mode === "text") {
            const buf = Buffer.from(await upstream.arrayBuffer());
            const truncated = buf.length >= PREVIEW_TEXT_MAX_BYTES;
            res.setHeader("Content-Type", "text/plain; charset=utf-8");
            res.setHeader("X-Preview-Truncated", truncated ? "1" : "0");
            return res.send(buf.toString("utf-8"));
        }

        const contentLength = upstream.headers.get("content-length");
        if (contentLength && Number(contentLength) > PREVIEW_BINARY_MAX_BYTES) {
            return res.status(413).json({error: "File too large to preview"});
        }

        res.status(upstream.status === 206 ? 206 : 200);
        // Zenodo sends `content-type` twice, and fetch joins repeated headers
        // into "image/png, image/png". Forwarded as-is that becomes the type of
        // the blob the client builds, which no viewer recognises — the PDF
        // iframe in particular refuses it. A media type never contains a comma,
        // so the first value is the whole answer.
        const upstreamType = upstream.headers.get("content-type")?.split(",")[0].trim();
        res.setHeader("Content-Type", upstreamType || "application/octet-stream");
        res.setHeader("Accept-Ranges", "bytes");
        const contentRange = upstream.headers.get("content-range");
        if (contentRange) res.setHeader("Content-Range", contentRange);

        return res.end(Buffer.from(await upstream.arrayBuffer()));
    } catch (err) {
        console.error("Preview proxy error:", err);
        if (err instanceof BlockedTargetError) {
            return res.status(403).json({error: "URL not permitted for preview"});
        }
        res.status(500).json({error: "Failed to fetch preview"});
    }
});

app.use(compression());

// TODO: user HTTP/2 server to support > 6 event source requests limit.
// see https://developer.mozilla.org/en-US/docs/Web/API/EventSource
if (DEVELOPMENT) {
    console.log("Starting development server");
    const viteDevServer = await import("vite").then((vite) =>
        vite.createServer({
            server: {middlewareMode: true},
        })
    );
    app.use(viteDevServer.middlewares);
    app.use(async (req, res, next) => {
        try {
            const source = await viteDevServer.ssrLoadModule(
                "virtual:react-router/server-build",
            );
            // @ts-expect-error - The source from viteDevServer is generic, but compatible at runtime
            return createRequestHandler({build: source})(req, res, next);
        } catch (error) {
            if (typeof error === "object" && error instanceof Error) {
                viteDevServer.ssrFixStacktrace(error);
            }
            next(error);
        }
    });
} else {
    console.log("Starting production server");
    app.use(
        "/assets",
        express.static("build/client/assets", {immutable: true, maxAge: "1y"}),
    );
    app.use(morgan("tiny"));
    app.use(express.static("build/client", {maxAge: "1h"}));

    const build = await import(
        path.resolve(process.cwd(), "build/server/index.js")
        );
    app.use(createRequestHandler({build}));
}

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
