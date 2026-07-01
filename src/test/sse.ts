import {HttpResponse} from "msw";

/**
 * Serialize events the way the backend does: one `data:` line per event,
 * events separated by a blank line.
 */
export const sse = (events: object[]) => events.map(e => `data: ${JSON.stringify(e)}\n\n`).join("");

export const sseResponse = (body: string) =>
    HttpResponse.text(body, {headers: {"Content-Type": "text/event-stream"}});
