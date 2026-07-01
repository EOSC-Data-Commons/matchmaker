import type {RequestHandler} from "msw";

// Global request handlers shared by all tests. Keep this list small: only
// endpoints that many tests rely on belong here. Test-specific responses
// should be added per-test with `server.use(...)`.
//
// These fixtures are the de-facto contract with the backend — when the API
// changes, update the handler and let the failing tests point at the impact.
export const handlers: RequestHandler[] = [];
