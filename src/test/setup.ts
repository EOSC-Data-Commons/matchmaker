import "@testing-library/jest-dom/vitest";
import {beforeAll, afterEach, afterAll} from "vitest";
import {cleanup} from "@testing-library/react";
import {server} from "./msw/server";

// RTL only auto-registers its cleanup when the runner exposes a global
// afterEach; with Vitest globals disabled we must unmount explicitly, or
// components leak across tests (still fetching, still re-rendering).
afterEach(cleanup);

// Node >= 22 defines its own experimental localStorage/sessionStorage globals
// which shadow happy-dom's (localStorage is undefined without a CLI flag).
// Replace both with a simple in-memory implementation so app code and tests
// share working storage. Spy on the instances (not Storage.prototype) when a
// test needs to simulate storage failures.
const memoryStorage = (): Storage => {
    const store = new Map<string, string>();
    return {
        get length() {
            return store.size;
        },
        clear: () => store.clear(),
        getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
        key: (index: number) => [...store.keys()][index] ?? null,
        removeItem: (key: string) => void store.delete(key),
        setItem: (key: string, value: string) => void store.set(key, String(value)),
    };
};

Object.defineProperty(globalThis, "localStorage", {
    value: memoryStorage(),
    writable: true,
    configurable: true,
});
Object.defineProperty(globalThis, "sessionStorage", {
    value: memoryStorage(),
    writable: true,
    configurable: true,
});

// MSW intercepts fetch for every test; onUnhandledRequest: 'error' makes a
// test fail loudly if code hits an endpoint without a handler, instead of
// silently reaching the network.
beforeAll(() => server.listen({onUnhandledRequest: "error"}));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
