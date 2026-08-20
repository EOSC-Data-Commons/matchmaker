import {describe, it, expect, beforeEach, afterEach} from "vitest";
import {
    CustomDimension,
    currentEnvironment,
    isSiteSearchLocation,
    setCustomDimension,
    trackEvent,
    trackPageView,
    trackSiteSearch,
} from "./analytics";

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

        it("does nothing when the tracker has not loaded", () => {
            delete (window as Partial<Window>)._paq;
            expect(() => trackEvent("Chat", "message_sent")).not.toThrow();
        });
    });

    describe("isSiteSearchLocation", () => {
        it("matches the results page when a query is present", () => {
            expect(isSiteSearchLocation("/search", "?q=ocean+temperature")).toBe(true);
        });

        it.each([
            ["no query string", "/search", ""],
            ["an empty query", "/search", "?q="],
            ["only a model param", "/search", "?model=cesnet%2Fagentic"],
            ["the landing page", "/", "?q=ocean"],
            ["the chat page", "/chat", "?q=ocean"],
        ])("does not match %s", (_label, pathname, search) => {
            expect(isSiteSearchLocation(pathname, search)).toBe(false);
        });
    });

    it("records a site search with its category and hit count", () => {
        trackSiteSearch("ocean temperature", "datasets", 0);
        expect(paq()[0]).toEqual(["trackSiteSearch", "ocean temperature", "datasets", 0]);
    });

    it("records a pageview", () => {
        trackPageView();
        expect(paq()[0]).toEqual(["trackPageView"]);
    });

    it("sets a custom dimension by its configured index", () => {
        setCustomDimension(CustomDimension.AuthState, "signed_in");
        expect(paq()[0]).toEqual(["setCustomDimension", CustomDimension.AuthState, "signed_in"]);
    });

    describe("currentEnvironment", () => {
        it.each([
            ["https://dev.matchmaker.eosc-data-commons.eu/search", "dev"],
            ["https://matchmaker.eosc-data-commons.eu/search", "prod"],
        ])("reports %s as %s", (href, expected) => {
            window.location.href = href;
            expect(currentEnvironment()).toBe(expected);
        });
    });
});
