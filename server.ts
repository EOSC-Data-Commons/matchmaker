import compression from "compression";
import express from "express";
import morgan from "morgan";
import path from "path";
import {createProxyMiddleware} from "http-proxy-middleware";
import {createRequestHandler} from "@react-router/express";


// Constants
const DEVELOPMENT = process.env.NODE_ENV !== "production";
const PORT = Number.parseInt(process.env.PORT || (DEVELOPMENT ? "5173" : "3000"));
const SEARCH_API_URL = process.env.SEARCH_API_URL || 'http://127.0.0.1:8000';
const PLAYER_API_URL = process.env.PLAYER_API_URL || 'https://dev1.player.eosc-data-commons.eu';

const app = express();

app.use(compression());
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

app.use('/api/player', createProxyMiddleware({
    target: PLAYER_API_URL,
    changeOrigin: true,
    pathRewrite: {'^/api/player': ''},
    secure: false,
    on: {
        error: (err, _req, res) => {
            console.error('Player API proxy error:', err);
            (res as express.Response).status(500).send('Proxy error');
        }
    }
}));

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
