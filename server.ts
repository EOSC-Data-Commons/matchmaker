import compression from "compression";
import express from "express";
import morgan from "morgan";
import path from "path";
import { createProxyMiddleware } from "http-proxy-middleware";
import { createRequestHandler } from "@react-router/express";

import {
    fetchDatasetFilesFromDatahuggerByUrl,
    FileMeta,
    fileMetaToFileEntry,
    getDataplayerClient,
    getToolSrcClient,
    launchTool,
} from "./src/lib/server/grpcClient.ts";

import {
    checkTaskStatus,
    prepareDispatcherMetadata,
    submitMetadataToDispatcher,
} from "./src/lib/deprecatedDispatcherApi.ts";

import {
    GetArtifactRequest,
    GetToolRequest,
    MatchToolsByDataRequest,
    MonitorStateRequest,
    MonitorStateResponse,
    SearchToolsByTextRequest,
    ToolState_State,
} from "./src/lib/server/generated/coordinator.ts";

// Constants
const DEVELOPMENT = process.env.NODE_ENV !== "production";
const PORT = Number.parseInt(
    process.env.PORT || (DEVELOPMENT ? "5173" : "3000"),
);
const SEARCH_API_URL = process.env.SEARCH_API_URL || "http://127.0.0.1:8000";
const COORDINATOR_API_URL = process.env.COORDINATOR_API_URL ||
  "https://eosc-coordinator.ethz.ch";

const app = express();

app.disable("x-powered-by");

// Proxies
app.use(
    "/api/search",
    createProxyMiddleware({
        target: SEARCH_API_URL,
        changeOrigin: true,
        pathRewrite: { "^/api/search": "" },
        on: {
            error: (err, _req, res) => {
                console.error("Search API proxy error:", err);
                (res as express.Response).status(500).send("Proxy error");
            },
        },
    }),
);

// placeholder for the coordinator service on internet over https
app.use(
    "/api/coordinator-online",
    createProxyMiddleware({
        target: COORDINATOR_API_URL,
        changeOrigin: true,
        pathRewrite: { "^/api/coordinator": "" },
        secure: false,
        on: {
            error: (err, _req, res) => {
                console.error("coordinator API proxy error:", err);
                (res as express.Response).status(500).send("Proxy error");
            },
        },
    }),
);

// TODO: rename to task/start
app.use(express.json());
app.post("/api/coordinator/start-task", async (req, res) => {
    console.debug("headers:", req.headers);
    console.debug("body:", req.body);
    // TODO: compile time type safety through a type/api.ts to share type info with client.
    // this can prevent the parsing typos etc.
    //
    // XXX: @reggie can I assume the unique id of tool in the tool registry is a valid UUID?
    const {
        selectedToolId,
        slotToFileMetaMapping,
    }: {
    selectedToolId: string;
    slotToFileMetaMapping: Record<string, FileMeta>;
  } = req.body;

    try {
    // 2️⃣ launch tool
        console.warn(selectedToolId);
        console.warn(slotToFileMetaMapping);
        const taskId = await launchTool(
            selectedToolId,
            slotToFileMetaMapping,
        );

        if (!taskId) {
            return res.status(500).json({ error: "No task_id returned" });
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

    const { taskId } = req.params;

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

    stream.on("data", (resp: MonitorStateResponse) => {
    // when state machine transit to the end state.
        const toolState = resp.status;
        const currentState = toolState?.state ?? null;

        // Stream progress
        if (currentState && currentState != lastState) {
            lastState = currentState;

            let stateStr = null;
            // XXX: ??? why currentState don't match?
            // if (currentState === ToolState_State.PREPARING) {
            //     stateStr = "PREPARING";
            // }
            if (currentState === ToolState_State.READY) {
                stateStr = "READY";
            }
            if (currentState === ToolState_State.DROPPED) {
                stateStr = "DROPPED";
            }
            if (currentState === ToolState_State.UNRECOGNIZED) {
                stateStr = "UNRECOGNIZED";
            }
            res.write(`event: state\ndata: ${
                JSON.stringify({
                    state: stateStr,
                    message: toolState?.log,
                })
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
    const { taskId } = req.params;
    const client = getDataplayerClient();
    try {
        const grpc_req: GetArtifactRequest = {
            handlerId: taskId,
        };
        let v_callbackUrl: string | null = null;

        client.getArtifact(grpc_req, (err, response) => {
            if (err) {
                console.error(err);
                return;
            }
            let callbackUrl: string | undefined;

            if (response.eoscInline) {
                callbackUrl = response.eoscInline.callbackUrl;
            } else if (response.hosted) {
                callbackUrl = response.hosted.callbackUrl;
            } else {
                console.error("No entry_point found");
                return;
            }
            v_callbackUrl = callbackUrl;
            res.send(v_callbackUrl);
        });
    } catch (err) {
        console.error(err);
    }
});

interface ToolConfig {
  name: string;
  description: string;
  slots: string[];
}

app.use(express.json());
app.post("/api/coordinator/tool/match", async (req, res) => {
    const client = getToolSrcClient();
    try {
        // XXX: @reggie here is the abstract interface to the tool registry.
        const { files } = req.body as { files: FileMeta[] };
        const grpc_req: MatchToolsByDataRequest = {
            files: files
                .filter(f => !f.isDir)
                .map(f => (fileMetaToFileEntry(f))),
        };

        client.matchToolsByData(grpc_req, (err, response) => {
            if (err) {
                console.error(err);
                return;
            }

            const foundTools: Record<string, ToolConfig> = {};
            for (const tool of response.tools) {
                const config: ToolConfig = {
                    name: tool.name,
                    description: tool.description,
                    slots: tool.slots,
                };

                foundTools[tool.id] = config;
            }
            res.json(foundTools);
        });
    } catch (err) {
        console.error(err);
    }
});

app.use(express.json());
app.get("/api/coordinator/tool/search", async (req, res) => {
    const client = getToolSrcClient();
    try {
        const query = req.query.q as string || "";
        const grpc_req: SearchToolsByTextRequest = {
            text: query,
        };

        client.searchToolsByText(grpc_req, (err, response) => {
            if (err) {
                console.error(err);
                return;
            }

            const foundTools: Record<string, ToolConfig> = {};
            for (const tool of response.tools) {
                const config: ToolConfig = {
                    name: tool.name,
                    description: tool.description,
                    slots: tool.slots,
                };

                foundTools[tool.id] = config;
            }
            res.json(foundTools);
        });
    } catch (err) {
        console.error(err);
    }
});

app.use(express.json());
app.get("/api/coordinator/tool/get/:toolId", async (req, res) => {
    const { toolId: id } = req.params;
    const client = getToolSrcClient();
    try {
    // XXX: @reggie here is the abstract interface to the tool registry.
        const grpc_req: GetToolRequest = {
            id,
        };

        client.getTool(grpc_req, (err, response) => {
            if (err) {
                console.error(err);
                return;
            }

            const tool = response.tool;
            if (!tool) {
                console.error("not a valid tool");
                return;
            }

            const config: ToolConfig = {
                name: tool.name,
                description: tool.description,
                slots: tool.slots,
            };

            res.json(config);
        });
    } catch (err) {
        console.error(err);
    }
});

// POST endpoint to prepare + submit metadata
app.use(express.json());
app.post("/api/coordinator/start-task-old", async (req, res) => {
    console.debug("headers:", req.headers);
    console.debug("body:", req.body);
    const { selectedVRE, fileParameterMappings, files, datasetTitle } = req.body;

    try {
    // 1️⃣ Prepare metadata
        const metadata = prepareDispatcherMetadata(
            selectedVRE,
            fileParameterMappings,
            files,
            datasetTitle,
        );

        // 2️⃣ Submit metadata
        const submissionResult = await submitMetadataToDispatcher(metadata);

        if (!submissionResult.task_id) {
            return res.status(500).json({ error: "No task_id returned" });
        }

        // 3️⃣ Return task ID for SSE tracking
        res.json({ taskId: submissionResult.task_id });
    } catch (err) {
        console.error(err);
        res.status(500).json({
            error: err instanceof Error ? err.message : String(err),
        });
    }
});

app.get("/api/coordinator/task-status-old/:taskId", async (req, res) => {
    const { taskId } = req.params;

    // SSE headers
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    const interval = setInterval(async () => {
        try {
            const statusResult = await checkTaskStatus(taskId);

            // Stream progress
            res.write(`event: progress\ndata: ${
                JSON.stringify({
                    status: statusResult.status,
                })
            }\n\n`);

            // Done
            if (
                statusResult.status === "SUCCESS" || statusResult.status === "FAILURE"
            ) {
                res.write(`event: result\ndata: ${JSON.stringify(statusResult)}\n\n`);
                clearInterval(interval);
                res.end();
            }
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);

            res.write(`event: error\ndata: ${JSON.stringify({ message })}\n\n`);
            clearInterval(interval);
            res.end();
        }
    }, 1000);

    // Clean up if client disconnects
    req.on("close", () => clearInterval(interval));
});

app.get("/api/coordinator/files", async (req, res) => {
    const handle = req.query.handle as string;
    if (!handle) {
        return res.status(400).json({ error: "Missing handle parameter" });
    }

    // TODO: cache entry, inmemory from start, and maybe move to use redis in production.

    try {
    // XXX: where error goes if url is invalid?? Should we give this to user??
        const url = `${handle}`;
        const files = await fetchDatasetFilesFromDatahuggerByUrl(url);
        res.json(files);
    } catch (err) {
        console.error("Error fetching files:", err);
        res.status(500).json({ error: "Failed to fetch files" });
    }
});

app.use(
    "/auth",
    createProxyMiddleware({
        target: SEARCH_API_URL,
        changeOrigin: false,
        pathRewrite: { "^/": "/auth/" },
        on: {
            error: (err, _req, res) => {
                console.error("Auth API proxy error:", err);
                (res as express.Response).status(500).send("Proxy error");
            },
        },
    }),
);

app.use(compression());

// TODO: user HTTP/2 server to support > 6 event source requests limit.
// see https://developer.mozilla.org/en-US/docs/Web/API/EventSource
if (DEVELOPMENT) {
    console.log("Starting development server");
    const viteDevServer = await import("vite").then((vite) =>
        vite.createServer({
            server: { middlewareMode: true },
        })
    );
    app.use(viteDevServer.middlewares);
    app.use(async (req, res, next) => {
        try {
            const source = await viteDevServer.ssrLoadModule(
                "virtual:react-router/server-build",
            );
            // @ts-expect-error - The source from viteDevServer is generic, but compatible at runtime
            return createRequestHandler({ build: source })(req, res, next);
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
        express.static("build/client/assets", { immutable: true, maxAge: "1y" }),
    );
    app.use(morgan("tiny"));
    app.use(express.static("build/client", { maxAge: "1h" }));

    const build = await import(
        path.resolve(process.cwd(), "build/server/index.js")
    );
    app.use(createRequestHandler({ build }));
}

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
