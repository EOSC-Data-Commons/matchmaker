import express from 'express';
import fs from 'fs';
import {createServer as createViteServer} from 'vite';
import path from 'path';
import {fileURLToPath} from 'url';
import {createProxyMiddleware} from 'http-proxy-middleware';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function createServer() {
    const app = express();

    // Create Vite server in middleware mode
    const vite = await createViteServer({
        server: {middlewareMode: true},
        appType: 'custom',
    });

    // Proxy API requests using http-proxy-middleware
    app.use('/api', createProxyMiddleware({
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        pathRewrite: {'^/api': ''},
        on: {
            error: (err, req, res) => {
                console.error('Proxy error:', err);
                (res as express.Response).status(500).send('Proxy error');
            }
        }
    }));

    // Proxy Player API requests
    app.use('/player-api', createProxyMiddleware({
        target: 'https://dev1.player.eosc-data-commons.eu',
        changeOrigin: true,
        pathRewrite: {'^/player-api': ''},
        secure: false,
        on: {
            error: (err, req, res) => {
                console.error('Player API proxy error:', err);
                (res as express.Response).status(500).send('Proxy error');
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

createServer().catch((error) => {
    console.error('Failed to start server:', error);
    process.exit(1);
});
