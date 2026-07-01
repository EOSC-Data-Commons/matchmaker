import {describe, it, expect, vi, beforeEach, afterEach} from "vitest";
import {renderHook, waitFor, act} from "@testing-library/react";
import {http, HttpResponse} from "msw";
import {server} from "@/test/msw/server";
import {useApiKeys} from "./useApiKeys";

describe("useApiKeys", () => {
    beforeEach(() => {
        vi.spyOn(console, "error").mockImplementation(() => {});
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("does not hit the endpoint until enabled", async () => {
        let hits = 0;
        server.use(http.get("/auth/keys", () => {
            hits++;
            return HttpResponse.json({key_ids: ["vip"]});
        }));
        const {result, rerender} = renderHook(({enabled}) => useApiKeys(enabled), {
            initialProps: {enabled: false},
        });

        // Give a pending fetch a chance to fire if the guard were broken
        await new Promise(r => setTimeout(r, 20));
        expect(hits).toBe(0);
        expect(result.current.loading).toBe(true);

        rerender({enabled: true});
        await waitFor(() => expect(result.current.loading).toBe(false));
        expect(hits).toBe(1);
        expect(result.current.configured).toEqual(new Set(["vip"]));
        expect(result.current.unavailable).toBe(false);
        expect(result.current.error).toBeNull();
    });

    it("flags the store as unavailable instead of erroring when Vault is down", async () => {
        server.use(http.get("/auth/keys", () =>
            HttpResponse.json({detail: "Vault is sealed"}, {status: 503}),
        ));
        const {result} = renderHook(() => useApiKeys(true));
        await waitFor(() => expect(result.current.loading).toBe(false));
        expect(result.current.unavailable).toBe(true);
        expect(result.current.error).toBeNull();
    });

    it("surfaces non-store errors as a user message", async () => {
        server.use(http.get("/auth/keys", () => new HttpResponse(null, {status: 401})));
        const {result} = renderHook(() => useApiKeys(true));
        await waitFor(() => expect(result.current.loading).toBe(false));
        expect(result.current.unavailable).toBe(false);
        expect(result.current.error).toBe("You must be logged in to manage API keys.");
    });

    it("save marks the key as configured", async () => {
        server.use(
            http.get("/auth/keys", () => HttpResponse.json({key_ids: []})),
            http.put("/auth/keys/github", () => new HttpResponse(null, {status: 204})),
        );
        const {result} = renderHook(() => useApiKeys(true));
        await waitFor(() => expect(result.current.loading).toBe(false));

        await act(() => result.current.save("github", "ghp_x"));
        expect(result.current.configured.has("github")).toBe(true);
    });

    it("remove unmarks the key", async () => {
        server.use(
            http.get("/auth/keys", () => HttpResponse.json({key_ids: ["vip", "github"]})),
            http.delete("/auth/keys/vip", () => new HttpResponse(null, {status: 204})),
        );
        const {result} = renderHook(() => useApiKeys(true));
        await waitFor(() => expect(result.current.loading).toBe(false));

        await act(() => result.current.remove("vip"));
        expect(result.current.configured).toEqual(new Set(["github"]));
    });

    it("save/remove propagate backend failures without mutating state", async () => {
        server.use(
            http.get("/auth/keys", () => HttpResponse.json({key_ids: ["vip"]})),
            http.put("/auth/keys/github", () =>
                HttpResponse.json({detail: "nope"}, {status: 422})),
        );
        const {result} = renderHook(() => useApiKeys(true));
        await waitFor(() => expect(result.current.loading).toBe(false));

        await expect(result.current.save("github", "x")).rejects.toThrow("nope");
        expect(result.current.configured.has("github")).toBe(false);
    });

    it("reveal returns the stored value", async () => {
        server.use(
            http.get("/auth/keys", () => HttpResponse.json({key_ids: ["vip"]})),
            http.get("/auth/keys/vip", () => HttpResponse.json({value: "secret-1"})),
        );
        const {result} = renderHook(() => useApiKeys(true));
        await waitFor(() => expect(result.current.loading).toBe(false));
        await expect(result.current.reveal("vip")).resolves.toBe("secret-1");
    });

    it("reload recovers after an outage", async () => {
        server.use(http.get("/auth/keys", () => HttpResponse.error()));
        const {result} = renderHook(() => useApiKeys(true));
        await waitFor(() => expect(result.current.unavailable).toBe(true));

        server.use(http.get("/auth/keys", () => HttpResponse.json({key_ids: ["vip"]})));
        await act(() => result.current.reload());
        expect(result.current.unavailable).toBe(false);
        expect(result.current.configured).toEqual(new Set(["vip"]));
    });
});
