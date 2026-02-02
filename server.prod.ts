import express from 'express';
import path from 'path';
import {fileURLToPath} from 'url';
import fs from 'fs';
import {createProxyMiddleware} from 'http-proxy-middleware';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function createServer() {
    const app = express();

    // Body parsing middleware for POST/PUT/PATCH requests
    app.use(express.json());
    app.use(express.urlencoded({extended: true}));

    // When compiled, this file is in dist/, so client and server are siblings
    const distPath = __dirname;
    const clientPath = path.resolve(distPath, 'client');
    const serverPath = path.resolve(distPath, 'server');

    // Serve static assets
    app.use(express.static(clientPath, {index: false}));

    // Proxy API requests
    const apiUrl = process.env.API_URL;
    if (apiUrl) {
        console.log(`Setting up API proxy to: ${apiUrl}`);
        app.use('/api', createProxyMiddleware({
            target: apiUrl,
            changeOrigin: true,
            pathRewrite: {'^/api': ''},
            on: {
                error: (err, req, res) => {
                    console.error('API proxy error:', err);
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
    } else {
        console.warn('WARNING: API_URL environment variable is not set. The /api proxy will not be available.');
        console.warn('This may cause the application to malfunction if it relies on backend API calls.');
        console.warn('Please set API_URL to the backend API endpoint (e.g., http://backend:8000)');
    }

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

    // Read the template
    const template = fs.readFileSync(
        path.resolve(clientPath, 'index.html'),
        'utf-8'
    );

    // Import the server-side render function
    const {render} = await import(path.resolve(serverPath, 'entry-server.js'));

    app.use(async (req, res, next) => {
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

createServer();
