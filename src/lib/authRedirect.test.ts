import {describe, it, expect, beforeEach, vi, afterEach} from "vitest";
import {loginWithReturn, consumePostLoginRedirect} from "./authRedirect";

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
