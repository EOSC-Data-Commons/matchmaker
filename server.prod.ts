import express from 'express';
import path from 'path';
import {fileURLToPath} from 'url';
import fs from 'fs';
import {createProxyMiddleware} from 'http-proxy-middleware';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function createServer() {
    const app = express();

    const distPath = path.resolve(__dirname, 'dist');
    const clientPath = path.resolve(distPath, 'client');
    const serverPath = path.resolve(distPath, 'server');

    // Serve static assets
    app.use(express.static(clientPath, {index: false}));

    // Proxy API requests
    const apiUrl = process.env.API_URL || 'http://127.0.0.1:8000';
    app.use('/api', createProxyMiddleware({
        target: apiUrl,
        changeOrigin: true,
        pathRewrite: {'^/api': ''},
        on: {
            error: (err, _req, res) => {
                console.error('API proxy error:', err);
                (res as express.Response).status(500).send('Proxy error');
            }
        }
    }));

    // Proxy Player API requests
    const playerApiUrl = process.env.PLAYER_API_URL || 'https://dev1.player.eosc-data-commons.eu';
    app.use('/player-api', createProxyMiddleware({
        target: playerApiUrl,
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

    // Read the template
    const template = fs.readFileSync(
        path.resolve(clientPath, 'index.html'),
        'utf-8'
    );

    // Import the server-side render function
    const {render} = await import(path.resolve(serverPath, 'entry-server.js'));

    // In server.prod.ts, replace the app.get('*', ...) with:
    app.use(async (req, res, next) => {
        // Only handle GET requests for SSR, let other methods pass through
        if (req.method !== 'GET') {
            return next();
        }
        try {
            const result = await render(req);
            // Handle redirects
            if (result.redirect) {
                return res.redirect(result.status || 302, result.redirect);
            }
            // Inject the app-rendered HTML into the template
            const html = template.replace('<!--ssr-outlet-->', result.html);
            res.status(200).set({'Content-Type': 'text/html'}).end(html);
        } catch (e) {
            console.error('SSR Error:', e);
            next(e);
        }
    });


    const port = process.env.PORT || 3000;
    app.listen(port, () => {
        console.log(`Production server running at http://localhost:${port}`);
    });
}

createServer().catch((error) => {
    console.error('Failed to start server:', error);
    process.exit(1);
});