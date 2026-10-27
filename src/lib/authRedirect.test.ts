import {describe, it, expect, beforeEach, vi, afterEach} from "vitest";
import {
    loginWithReturn,
    consumePostLoginRedirect,
    loginForAiMode,
    returnedFromAiModeLogin,
    clearAiModeLogin,
} from "./authRedirect";

const setUrl = (url: string) => {
    (window as unknown as { happyDOM: { setURL: (u: string) => void } }).happyDOM.setURL(url);
};

describe("auth redirect round-trip", () => {
    beforeEach(() => {
        sessionStorage.clear();
        setUrl("http://localhost:5173/");
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("stashes path and query, then navigates to /auth/login", () => {
        setUrl("http://localhost:5173/search?q=climate&page=2");
        loginWithReturn();
        expect(sessionStorage.getItem("postLoginRedirect")).toBe("/search?q=climate&page=2");
        expect(window.location.pathname).toBe("/auth/login");
    });

    it("consume returns the stashed target exactly once", () => {
        setUrl("http://localhost:5173/profile");
        loginWithReturn();
        expect(consumePostLoginRedirect()).toBe("/profile");
        expect(consumePostLoginRedirect()).toBeNull();
    });

    it("consume returns null when nothing was stashed", () => {
        expect(consumePostLoginRedirect()).toBeNull();
    });

    it("still navigates to login when sessionStorage is unavailable", () => {
        const spy = vi.spyOn(sessionStorage, "setItem").mockImplementation(() => {
            throw new Error("blocked");
        });
        loginWithReturn();
        expect(spy).toHaveBeenCalled();
        expect(window.location.pathname).toBe("/auth/login");
    });

    it("consume returns null when sessionStorage reads throw", () => {
        vi.spyOn(sessionStorage, "getItem").mockImplementation(() => {
            throw new Error("blocked");
        });
        expect(consumePostLoginRedirect()).toBeNull();
    });
});

describe("AI mode kept across the login", () => {
    beforeEach(() => {
        sessionStorage.clear();
        setUrl("http://localhost:5173/");
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("marks the current page and logs in with a return to it", () => {
        setUrl("http://localhost:5173/search?q=climate");
        loginForAiMode();
        expect(sessionStorage.getItem("postLoginAiMode")).toBe("/search?q=climate");
        expect(sessionStorage.getItem("postLoginRedirect")).toBe("/search?q=climate");
        expect(window.location.pathname).toBe("/auth/login");
    });

    it("only reports the marked page, and keeps the mark until cleared", () => {
        setUrl("http://localhost:5173/search?q=climate");
        loginForAiMode();

        // The IdP may land the user on another page before useAuth sends them on.
        setUrl("http://localhost:5173/");
        expect(returnedFromAiModeLogin()).toBe(false);

        setUrl("http://localhost:5173/search?q=climate");
        expect(returnedFromAiModeLogin()).toBe(true);
        expect(returnedFromAiModeLogin()).toBe(true);

        clearAiModeLogin();
        expect(returnedFromAiModeLogin()).toBe(false);
    });

    it("still logs in when sessionStorage is unavailable", () => {
        vi.spyOn(sessionStorage, "setItem").mockImplementation(() => {
            throw new Error("blocked");
        });
        loginForAiMode();
        expect(window.location.pathname).toBe("/auth/login");
        expect(returnedFromAiModeLogin()).toBe(false);
    });
});
