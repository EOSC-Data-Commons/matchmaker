import {renderToString} from 'react-dom/server';
import {
    createStaticHandler,
    createStaticRouter,
    StaticRouterProvider
} from 'react-router';
import type {Request as ExpressRequest} from 'express';
import {routes} from './routes';

export async function render(request: ExpressRequest) {
    const {query, dataRoutes} = createStaticHandler(routes);

    // Create a Fetch API Request from Express request
    const fetchRequest = createFetchRequest(request);

    const context = await query(fetchRequest);

    // Handle redirects
    if (context instanceof Response) {
        return {
            redirect: context.headers.get('Location'),
            status: context.status,
        };
    }

    const router = createStaticRouter(dataRoutes, context);

    const html = renderToString(
        <StaticRouterProvider router={router} context={context}/>
    );

    return {html};
}

function createFetchRequest(req: ExpressRequest): Request {
    const origin = `${req.protocol}://${req.get('host')}`;
    const url = new URL(req.originalUrl || req.url, origin);

    const controller = new AbortController();

    req.on('close', () => {
        controller.abort();
    });

    const headers = new Headers();
    for (const [key, values] of Object.entries(req.headers)) {
        if (values) {
            if (Array.isArray(values)) {
                for (const value of values) {
                    headers.append(key, value);
                }
            } else {
                headers.set(key, values);
            }
        }
    }

    const init: RequestInit = {
        method: req.method,
        headers,
        signal: controller.signal,
    };

    if (req.method !== 'GET' && req.method !== 'HEAD') {
        init.body = req.body;
    }

    return new Request(url.href, init);
}