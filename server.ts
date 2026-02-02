import express from 'express';
import fs from 'fs';
import {createServer as createViteServer} from 'vite';
import path from 'path';
import {fileURLToPath} from 'url';
import {createProxyMiddleware} from 'http-proxy-middleware';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function createServer() {
    const app = express();

    // Body parsing middleware for POST/PUT/PATCH requests
    app.use(express.json());
    app.use(express.urlencoded({extended: true}));

    // Create Vite server in middleware mode
    const vite = await createViteServer({
        server: {middlewareMode: true},
        appType: 'custom',
    });

    // Proxy API requests using http-proxy-middleware
    const devApiUrl = process.env.API_URL || 'http://127.0.0.1:8000';
    console.log(`Setting up API proxy to: ${devApiUrl}`);
    app.use('/api', createProxyMiddleware({
        target: devApiUrl,
        changeOrigin: true,
        pathRewrite: {'^/api': ''},
        on: {
            error: (err, req, res) => {
                console.error('Proxy error:', err);
                const expressRes = res as express.Response;
                if (!expressRes.headersSent) {
                    expressRes.status(500).send('Proxy error');
                } else {
                    // Headers already sent, gracefully close the connection
                    console.error('Cannot send error response, headers already sent');
                    expressRes.end();
                }
            }
        }
    }));

    // Proxy Player API requests
    const playerApiUrl = process.env.PLAYER_API_URL || 'https://dev1.player.eosc-data-commons.eu';
    console.log(`Setting up Player API proxy to: ${playerApiUrl}`);
    app.use('/player-api', createProxyMiddleware({
        target: playerApiUrl,
        changeOrigin: true,
        pathRewrite: {'^/player-api': ''},
        secure: true,
        on: {
            error: (err, req, res) => {
                console.error('Player API proxy error:', err);
                const expressRes = res as express.Response;
                if (!expressRes.headersSent) {
                    expressRes.status(500).send('Proxy error');
                } else {
                    // Headers already sent, gracefully close the connection
                    console.error('Cannot send error response, headers already sent');
                    expressRes.end();
                }
            }
        }
    }));

    // Use vite's connect instance as middleware (AFTER API, BEFORE SSR handler)
    app.use(vite.middlewares);

    app.use(async (req, res, next) => {
        const url = req.originalUrl;

        try {
            // Read index.html
            const template = await vite.transformIndexHtml(
                url,
                fs.readFileSync(
                    path.resolve(__dirname, 'index.html'),
                    'utf-8'
                )
            );

            // Load the server entry
            const {render} = await vite.ssrLoadModule('/src/entry-server.tsx');

            // Render the app
            const result = await render(req);

            // Handle redirects
            if (result.redirect) {
                return res.redirect(result.status || 302, result.redirect);
            }

            // Inject the app-rendered HTML into the template
            const html = template.replace('<!--ssr-outlet-->', result.html);

            res.status(200).set({'Content-Type': 'text/html'}).end(html);
        } catch (e) {
            // If an error is caught, let Vite fix the stack trace
            vite.ssrFixStacktrace(e as Error);
            next(e);
        }
    });

    const port = process.env.PORT || 5173;
    app.listen(port, () => {
        console.log(`SSR dev server running at http://localhost:${port}`);
    });
}

createServer();
