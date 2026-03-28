import compression from "compression";
import express from "express";
import morgan from "morgan";
import path from "path";
import {createProxyMiddleware} from "http-proxy-middleware";
import {createRequestHandler} from "@react-router/express";

import {
    fetchDatasetFilesFromDatahuggerByUrl,
    FileMeta,
} from "./src/lib/grpcClient.ts";

import {
    submitMetadataToDispatcher,
    prepareDispatcherMetadata,
    checkTaskStatus,
} from './src/lib/coordinatorApi';


// Constants
const DEVELOPMENT = process.env.NODE_ENV !== "production";
const PORT = Number.parseInt(process.env.PORT || (DEVELOPMENT ? "5173" : "3000"));
const SEARCH_API_URL = process.env.SEARCH_API_URL || 'http://127.0.0.1:8000';
const COORDINATOR_API_URL = process.env.COORDINATOR_API_URL || 'https://eosc-coordinator.ethz.ch';

const app = express();

// Fetch files
export const fetchFiles = async (
    datasetHandle: string,
): Promise<FileMeta[]> => {
    const url = `${datasetHandle}`;
    const files = await fetchDatasetFilesFromDatahuggerByUrl(url);

    return files;
};


app.disable("x-powered-by");

// Proxies
app.use('/api/search', createProxyMiddleware({
    target: SEARCH_API_URL,
    changeOrigin: true,
    pathRewrite: {'^/api/search': ''},
    on: {
        error: (err, _req, res) => {
            console.error('Search API proxy error:', err);
            (res as express.Response).status(500).send('Proxy error');
        }
    }
}));

// placeholder for the coordinator service on internet over https
app.use('/api/coordinator-online', createProxyMiddleware({
    target: COORDINATOR_API_URL,
    changeOrigin: true,
    pathRewrite: {'^/api/coordinator': ''},
    secure: false,
    on: {
        error: (err, _req, res) => {
            console.error('coordinator API proxy error:', err);
            (res as express.Response).status(500).send('Proxy error');
        }
    }
}));

// POST endpoint to prepare + submit metadata
app.use(express.json());
app.post("/api/coordinator/start-task", async (req, res) => {
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
        res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
});

app.get("/api/coordinator/task-status/:taskId", async (req, res) => {
    const { taskId } = req.params;

    // SSE headers
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    const interval = setInterval(async () => {
        try {
            const statusResult = await checkTaskStatus(taskId);

            // Stream progress
            res.write(`event: progress\ndata: ${JSON.stringify({
                status: statusResult.status,
            })}\n\n`);

            // Done
            if (statusResult.status === "SUCCESS" || statusResult.status === "FAILURE") {
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
    if (!handle) return res.status(400).json({ error: "Missing handle parameter" });

    try {
    // XXX: where is this error goes?? Should we give this to user??
        const files = await fetchFiles(handle);
        res.json( files );
    } catch (err) {
        console.error("Error fetching files:", err);
        res.status(500).json({ error: "Failed to fetch files" });
    }
});


app.use('/auth', createProxyMiddleware({
    target: SEARCH_API_URL,
    changeOrigin: false,
    pathRewrite: {'^/': '/auth/'},
    on: {
        error: (err, _req, res) => {
            console.error('Auth API proxy error:', err);
            (res as express.Response).status(500).send('Proxy error');
        }
    }
}));

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
            const source = await viteDevServer.ssrLoadModule("virtual:react-router/server-build");
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
        express.static("build/client/assets", {immutable: true, maxAge: "1y"})
    );
    app.use(morgan("tiny"));
    app.use(express.static("build/client", {maxAge: "1h"}));

    const build = await import(path.resolve(process.cwd(), "build/server/index.js"));
    app.use(createRequestHandler({build}));
}

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
