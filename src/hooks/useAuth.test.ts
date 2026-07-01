import {describe, it, expect, vi, beforeEach, afterEach} from "vitest";
import {renderHook, waitFor} from "@testing-library/react";
import {http, HttpResponse} from "msw";
import {server} from "@/test/msw/server";
import {useAuth, type UserInfo} from "./useAuth";

const jane: UserInfo = {sub: "user-1", email: "jane@example.org", name: "Jane Doe"};

const setUrl = (url: string) => {
    (window as unknown as {happyDOM: {setURL: (u: string) => void}}).happyDOM.setURL(url);
};

describe("useAuth", () => {
    beforeEach(() => {
        sessionStorage.clear();
        setUrl("http://localhost:5173/profile");
        vi.spyOn(console, "error").mockImplementation(() => {});
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("exposes the user once /auth/user resolves", async () => {
        server.use(http.get("/auth/user", () => HttpResponse.json(jane)));
        const {result} = renderHook(() => useAuth());

        expect(result.current.loading).toBe(true);
        await waitFor(() => expect(result.current.loading).toBe(false));
        expect(result.current.user).toEqual(jane);
    });

    it("stays anonymous on 401", async () => {
        server.use(http.get("/auth/user", () => new HttpResponse(null, {status: 401})));
        const {result} = renderHook(() => useAuth());
        await waitFor(() => expect(result.current.loading).toBe(false));
        expect(result.current.user).toBeNull();
    });

    it("stays anonymous when the request fails", async () => {
        server.use(http.get("/auth/user", () => HttpResponse.error()));
        const {result} = renderHook(() => useAuth());
        await waitFor(() => expect(result.current.loading).toBe(false));
        expect(result.current.user).toBeNull();
    });

    it("returns the user to the stashed page after login", async () => {
        server.use(http.get("/auth/user", () => HttpResponse.json(jane)));
        sessionStorage.setItem("postLoginRedirect", "/search?q=climate");
        const {result} = renderHook(() => useAuth());

        await waitFor(() => expect(result.current.loading).toBe(false));
        await waitFor(() => expect(window.location.pathname).toBe("/search"));
        expect(window.location.search).toBe("?q=climate");
        // The stash is consumed — a remount must not redirect again
        expect(sessionStorage.getItem("postLoginRedirect")).toBeNull();
    });

    it("does not redirect when the stashed target is the current page", async () => {
        server.use(http.get("/auth/user", () => HttpResponse.json(jane)));
        sessionStorage.setItem("postLoginRedirect", "/profile");
        const {result} = renderHook(() => useAuth());

        await waitFor(() => expect(result.current.loading).toBe(false));
        expect(window.location.pathname).toBe("/profile");
        expect(sessionStorage.getItem("postLoginRedirect")).toBeNull();
    });

    it("logout navigates to /auth/logout", async () => {
        server.use(http.get("/auth/user", () => HttpResponse.json(jane)));
        const {result} = renderHook(() => useAuth());
        await waitFor(() => expect(result.current.loading).toBe(false));

        result.current.logout();
        expect(window.location.pathname).toBe("/auth/logout");
    });
});
