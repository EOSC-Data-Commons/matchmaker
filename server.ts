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
            error: (err, _req, res) => {
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
            error: (err, _req, res) => {
                console.error('Player API proxy error:', err);
                (res as express.Response).status(500).send('Proxy error');
            }
        }
    }));

    // Use Vite's middleware for handling requests
    app.use(vite.middlewares);

    app.use(async (req, res, next) => {
        const url = req.originalUrl;
        try {
            const template = await vite.transformIndexHtml(
                url,
                fs.readFileSync(
                    path.resolve(__dirname, 'index.html'),
                    'utf-8'
                )
            );
            const {render} = await vite.ssrLoadModule('/src/entry-server.tsx');
            const result = await render(req);
            if (result.redirect) {
                return res.redirect(result.status || 302, result.redirect);
            }
            // Inject the app-rendered HTML into the template
            const html = template.replace('<!--ssr-outlet-->', result.html);

            res.status(200).set({'Content-Type': 'text/html'}).end(html);
        } catch (e) {
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
