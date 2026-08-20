import {describe, it, expect, beforeEach, afterEach} from "vitest";
import {errorKind, siteSearchKeyword, trackEvent, trackPageView, trackSiteSearch} from "./analytics";
import {RateLimitError, ServerError} from "./api";

type Paq = Array<Array<string | number>>;
const paq = () => window._paq as unknown as Paq;

describe("analytics", () => {
    beforeEach(() => {
        window._paq = [];
    });

    afterEach(() => {
        delete (window as Partial<Window>)._paq;
    });

    describe("trackEvent", () => {
        it("pushes category and action", () => {
            trackEvent("Chat", "message_sent");
            expect(paq()[0]).toEqual(["trackEvent", "Chat", "message_sent"]);
        });

        it("appends name and numeric value in Matomo's positional order", () => {
            trackEvent("Chat", "run_latency_ms", "cesnet/agentic", 1200);
            expect(paq()[0]).toEqual(["trackEvent", "Chat", "run_latency_ms", "cesnet/agentic", 1200]);
        });

        // Matomo reads the slots positionally, so a value with no name would
        // otherwise be filed as the event name.
        it("pads the name slot when a value is given without a name", () => {
            trackEvent("Search", "latency_ms", undefined, 42);
            expect(paq()[0]).toEqual(["trackEvent", "Search", "latency_ms", "", 42]);
        });

        it("keeps a zero value rather than dropping it as falsy", () => {
            trackEvent("Search", "results_returned", "ocean", 0);
            expect(paq()[0]).toEqual(["trackEvent", "Search", "results_returned", "ocean", 0]);
        });

        it("does nothing when the tracker has not loaded", () => {
            delete (window as Partial<Window>)._paq;
            expect(() => trackEvent("Chat", "message_sent")).not.toThrow();
        });
    });

    describe("siteSearchKeyword", () => {
        it("returns the keyword on the results page", () => {
            expect(siteSearchKeyword("/search", "?q=ocean+temperature")).toBe("ocean temperature");
        });

        it("ignores other params so a filter change keeps the same keyword", () => {
            expect(siteSearchKeyword("/search", "?q=ocean&creator=Doe")).toBe("ocean");
        });

        it.each([
            ["no query string", "/search", ""],
            ["an empty query", "/search", "?q="],
            ["only a model param", "/search", "?model=cesnet%2Fagentic"],
            ["the landing page", "/", "?q=ocean"],
            ["the chat page", "/chat", "?q=ocean"],
        ])("returns null for %s", (_label, pathname, search) => {
            expect(siteSearchKeyword(pathname, search)).toBeNull();
        });
    });

    it("records a site search with its hit count and no category", () => {
        trackSiteSearch("ocean temperature", false, 0);
        expect(paq()[0]).toEqual(["trackSiteSearch", "ocean temperature", false, 0]);
    });

    it("records a pageview", () => {
        trackPageView();
        expect(paq()[0]).toEqual(["trackPageView"]);
    });

    describe("errorKind", () => {
        it.each([
            ["a rate limit", new RateLimitError(), "rate_limit"],
            ["a server error", new ServerError(503), "server"],
            ["a timeout", new Error("The request timed out"), "timeout"],
            ["a network failure", new Error("Failed to fetch"), "network"],
            ["anything else", new Error("boom"), "unknown"],
            ["a non-error", "just a string", "unknown"],
        ])("labels %s as %s", (_label, error, expected) => {
            expect(errorKind(error)).toBe(expected);
        });
    });
});
