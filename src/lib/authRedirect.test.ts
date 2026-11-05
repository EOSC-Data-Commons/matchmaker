import {describe, it, expect, beforeEach, vi, afterEach} from "vitest";
import {
    loginWithReturn,
    consumePostLoginRedirect,
    consumeLoginTrigger,
    loginForAiMode,
    returnedFromAiModeLogin,
    clearAiModeLogin,
} from "./authRedirect";

type Paq = Array<Array<string | number | boolean>>;
const paq = () => window._paq as unknown as Paq;

const setUrl = (url: string) => {
    (window as unknown as { happyDOM: { setURL: (u: string) => void } }).happyDOM.setURL(url);
};

describe("auth redirect round-trip", () => {
    beforeEach(() => {
        sessionStorage.clear();
        window._paq = [];
        setUrl("http://localhost:5173/");
    });

    afterEach(() => {
        vi.restoreAllMocks();
        delete (window as Partial<Window>)._paq;
    });

    it("stashes path and query, then navigates to /auth/login", () => {
        setUrl("http://localhost:5173/search?q=climate&page=2");
        loginWithReturn("header_search");
        expect(sessionStorage.getItem("postLoginRedirect")).toBe("/search?q=climate&page=2");
        expect(window.location.pathname).toBe("/auth/login");
    });

    it("stashes an explicit return path when the current page is not where to come back to", () => {
        setUrl("http://localhost:5173/search?q=climate");
        loginWithReturn("header_landing", "/");
        expect(sessionStorage.getItem("postLoginRedirect")).toBe("/");
    });

    it("reports the trigger at once and stashes it for the return leg", () => {
        loginWithReturn("play_button");
        expect(paq()).toContainEqual(["trackEvent", "Auth", "login_started", "play_button"]);
        expect(consumeLoginTrigger()).toBe("play_button");
        expect(consumeLoginTrigger()).toBeNull();
    });

    it("never turns an unknown stored trigger into an event name", () => {
        sessionStorage.setItem("postLoginTrigger", "<script>");
        expect(consumeLoginTrigger()).toBeNull();
        expect(sessionStorage.getItem("postLoginTrigger")).toBeNull();
    });

    it("consume returns the stashed target exactly once", () => {
        setUrl("http://localhost:5173/profile");
        loginWithReturn("gate_profile");
        expect(consumePostLoginRedirect()).toBe("/profile");
        expect(consumePostLoginRedirect()).toBeNull();
    });

    it("consume returns null when nothing was stashed", () => {
        expect(consumePostLoginRedirect()).toBeNull();
        expect(consumeLoginTrigger()).toBeNull();
    });

    it("still navigates to login when sessionStorage is unavailable", () => {
        const spy = vi.spyOn(sessionStorage, "setItem").mockImplementation(() => {
            throw new Error("blocked");
        });
        loginWithReturn("header_search");
        expect(spy).toHaveBeenCalled();
        expect(window.location.pathname).toBe("/auth/login");
    });

    it("consume returns null when sessionStorage reads throw", () => {
        vi.spyOn(sessionStorage, "getItem").mockImplementation(() => {
            throw new Error("blocked");
        });
        expect(consumePostLoginRedirect()).toBeNull();
        expect(consumeLoginTrigger()).toBeNull();
    });
});

describe("AI mode kept across the login", () => {
    beforeEach(() => {
        sessionStorage.clear();
        window._paq = [];
        setUrl("http://localhost:5173/");
    });

    afterEach(() => {
        vi.restoreAllMocks();
        delete (window as Partial<Window>)._paq;
    });

    it("marks the current page and logs in with a return to it", () => {
        setUrl("http://localhost:5173/search?q=climate");
        loginForAiMode();
        expect(sessionStorage.getItem("postLoginAiMode")).toBe("/search?q=climate");
        expect(sessionStorage.getItem("postLoginRedirect")).toBe("/search?q=climate");
        expect(window.location.pathname).toBe("/auth/login");
    });

    it("is reported as the AI Mode toggle", () => {
        loginForAiMode();
        expect(paq()).toContainEqual(["trackEvent", "Auth", "login_started", "ai_mode_toggle"]);
        expect(consumeLoginTrigger()).toBe("ai_mode_toggle");
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
