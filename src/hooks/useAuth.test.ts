import {describe, it, expect, vi, beforeEach, afterEach} from "vitest";
import {renderHook, waitFor} from "@testing-library/react";
import {http, HttpResponse} from "msw";
import {server} from "@/test/msw/server";
import {useAuth, type UserInfo} from "./useAuth";

const jane: UserInfo = {sub: "user-1", email: "jane@example.org", name: "Jane Doe"};

const setUrl = (url: string) => {
    (window as unknown as {happyDOM: {setURL: (u: string) => void}}).happyDOM.setURL(url);
};

type Paq = Array<Array<string | number | boolean>>;
const paq = () => window._paq as unknown as Paq;
const events = () => paq().filter(c => c[0] === "trackEvent");

describe("useAuth", () => {
    beforeEach(() => {
        sessionStorage.clear();
        window._paq = [];
        setUrl("http://localhost:5173/profile");
        vi.spyOn(console, "error").mockImplementation(() => {});
    });

    afterEach(() => {
        vi.restoreAllMocks();
        delete (window as Partial<Window>)._paq;
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

    it("keeps the AI mode mark while sending the user on to the stashed page", async () => {
        server.use(http.get("/auth/user", () => HttpResponse.json(jane)));
        sessionStorage.setItem("postLoginRedirect", "/search?q=climate");
        sessionStorage.setItem("postLoginAiMode", "/search?q=climate");
        const {result} = renderHook(() => useAuth());

        await waitFor(() => expect(result.current.loading).toBe(false));
        await waitFor(() => expect(window.location.pathname).toBe("/search"));
        expect(sessionStorage.getItem("postLoginAiMode")).toBe("/search?q=climate");
    });

    it("clears the AI mode mark once the user is on the marked page", async () => {
        server.use(http.get("/auth/user", () => HttpResponse.json(jane)));
        sessionStorage.setItem("postLoginAiMode", "/profile");
        const {result} = renderHook(() => useAuth());

        await waitFor(() => expect(result.current.loading).toBe(false));
        expect(sessionStorage.getItem("postLoginAiMode")).toBeNull();
    });

    it("leaves another page's AI mode mark alone", async () => {
        server.use(http.get("/auth/user", () => HttpResponse.json(jane)));
        sessionStorage.setItem("postLoginAiMode", "/search?q=climate");
        const {result} = renderHook(() => useAuth());

        await waitFor(() => expect(result.current.loading).toBe(false));
        expect(sessionStorage.getItem("postLoginAiMode")).toBe("/search?q=climate");
    });

    it("logout navigates to /auth/logout", async () => {
        server.use(http.get("/auth/user", () => HttpResponse.json(jane)));
        const {result} = renderHook(() => useAuth());
        await waitFor(() => expect(result.current.loading).toBe(false));

        result.current.logout();
        expect(window.location.pathname).toBe("/auth/logout");
    });

    it("reports the completed login under the trigger that started it", async () => {
        server.use(http.get("/auth/user", () => HttpResponse.json(jane)));
        sessionStorage.setItem("postLoginRedirect", "/profile");
        sessionStorage.setItem("postLoginTrigger", "gate_profile");
        const {result} = renderHook(() => useAuth());

        await waitFor(() => expect(result.current.loading).toBe(false));
        expect(events()).toContainEqual(["trackEvent", "Auth", "login_completed", "gate_profile"]);
        expect(sessionStorage.getItem("postLoginTrigger")).toBeNull();
    });

    it("reports an unknown trigger when only the target survived", async () => {
        server.use(http.get("/auth/user", () => HttpResponse.json(jane)));
        sessionStorage.setItem("postLoginRedirect", "/profile");
        const {result} = renderHook(() => useAuth());

        await waitFor(() => expect(result.current.loading).toBe(false));
        expect(events()).toContainEqual(["trackEvent", "Auth", "login_completed", "unknown"]);
    });

    it("does not report a login on an ordinary reload with a session", async () => {
        server.use(http.get("/auth/user", () => HttpResponse.json(jane)));
        const {result} = renderHook(() => useAuth());

        await waitFor(() => expect(result.current.loading).toBe(false));
        expect(events().some(c => c[2] === "login_completed")).toBe(false);
    });

    // Several components mount this hook on every page; the visit is marked once.
    it("marks a signed-in visit once per session", async () => {
        server.use(http.get("/auth/user", () => HttpResponse.json(jane)));
        const first = renderHook(() => useAuth());
        await waitFor(() => expect(first.result.current.loading).toBe(false));
        const second = renderHook(() => useAuth());
        await waitFor(() => expect(second.result.current.loading).toBe(false));

        expect(events().filter(c => c[2] === "signed_in_visit")).toEqual([["trackEvent", "Auth", "signed_in_visit"]]);
    });

    it("does not mark an anonymous visit", async () => {
        server.use(http.get("/auth/user", () => new HttpResponse(null, {status: 401})));
        const {result} = renderHook(() => useAuth());
        await waitFor(() => expect(result.current.loading).toBe(false));
        expect(events()).toEqual([]);
    });

    it("reports the logout before leaving", async () => {
        server.use(http.get("/auth/user", () => HttpResponse.json(jane)));
        const {result} = renderHook(() => useAuth());
        await waitFor(() => expect(result.current.loading).toBe(false));

        result.current.logout();
        expect(events()).toContainEqual(["trackEvent", "Auth", "logout"]);
    });
});
