import {describe, it, expect, beforeEach, afterEach} from "vitest";
import {
    analyticsEnabled,
    datasetEventName,
    errorKind,
    onceInSession,
    pageTitle,
    siteSearchKeyword,
    trackedUrl,
    trackEvent,
    trackLink,
    trackPageView,
    trackSiteSearch,
} from "./analytics";
import {RateLimitError, ServerError} from "./api";
import type {BackendDataset} from "../types/commons";

type Paq = Array<Array<string | number | boolean>>;
const paq = () => window._paq as unknown as Paq;

const hit = (source: Partial<BackendDataset["_source"]>): BackendDataset => ({
    _id: "",
    _source: {titles: [], descriptions: [], publicationYear: "", ...source},
    _score: 0,
} as BackendDataset);

describe("analytics", () => {
    beforeEach(() => {
        window._paq = [];
        localStorage.clear();
        sessionStorage.clear();
    });

    afterEach(() => {
        delete (window as Partial<Window>)._paq;
    });

    describe("trackEvent", () => {
        it("pushes category and action for an event without a name", () => {
            trackEvent("Auth", "logout");
            expect(paq()[0]).toEqual(["trackEvent", "Auth", "logout"]);
        });

        it("appends name and numeric value in Matomo's positional order", () => {
            trackEvent("AI Mode", "answer_completed", "cesnet/agentic", 1200);
            expect(paq()[0]).toEqual(["trackEvent", "AI Mode", "answer_completed", "cesnet/agentic", 1200]);
        });

        // Matomo reads the slots positionally, so a value with no name would
        // otherwise be filed as the event name.
        it("pads the name slot when a value is given without a name", () => {
            trackEvent("Data Player", "files_loaded", undefined, 42);
            expect(paq()[0]).toEqual(["trackEvent", "Data Player", "files_loaded", "", 42]);
        });

        it("keeps a zero value rather than dropping it as falsy", () => {
            trackEvent("Data Player", "tools_listed", "file_match", 0);
            expect(paq()[0]).toEqual(["trackEvent", "Data Player", "tools_listed", "file_match", 0]);
        });

        it("does nothing when the tracker has not loaded", () => {
            delete (window as Partial<Window>)._paq;
            expect(() => trackEvent("Auth", "logout")).not.toThrow();
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

    describe("trackSiteSearch", () => {
        it("records a plain search with its hit count", () => {
            trackSiteSearch("ocean temperature", "search", 0);
            expect(paq()[0]).toEqual(["trackSiteSearch", "ocean temperature", "search", 0]);
        });

        it("records an AI question with an unknown count when the run failed", () => {
            trackSiteSearch("which datasets cover the Adriatic?", "ai", false);
            expect(paq()[0]).toEqual(["trackSiteSearch", "which datasets cover the Adriatic?", "ai", false]);
        });
    });

    it("records a pageview", () => {
        trackPageView();
        expect(paq()[0]).toEqual(["trackPageView"]);
    });

    it("records a link Matomo could not see being clicked", () => {
        trackLink("https://example.org/file.csv", "download");
        expect(paq()[0]).toEqual(["trackLink", "https://example.org/file.csv", "download"]);
    });

    describe("trackedUrl", () => {
        it.each([
            ["a conversation", "/chat/b63fadcbb5af4636a61cc90b6b4a8a83", "", "/chat/:id"],
            ["a conversation export", "/chat/b63fadcbb5af4636/export", "?byline=1", "/chat/:id/export"],
            ["a new conversation", "/chat", "", "/chat"],
            ["the dataplayer", "/dataplayer", "?datasetId=https://doi.org/10.1/x&title=A%20very%20long%20title&pid=10.1/x&q=ocean", "/dataplayer"],
            ["the home page", "/", "?q=ocean", "/"],
            ["the profile", "/profile", "", "/profile"],
        ])("reduces %s to its route", (_label, pathname, search, expected) => {
            expect(trackedUrl(pathname, search)).toBe(expected);
        });

        it("keeps the query on the results page for site search", () => {
            expect(trackedUrl("/search", "?q=ocean&creator=Doe&model=cesnet%2Fagentic"))
                .toBe("/search?q=ocean&creator=Doe&model=cesnet%2Fagentic");
        });

        it("keeps campaign parameters so tagged links are attributed", () => {
            expect(trackedUrl("/dataplayer", "?datasetId=x&mtm_campaign=launch&utm_source=newsletter&pk_kwd=eosc"))
                .toBe("/dataplayer?mtm_campaign=launch&utm_source=newsletter&pk_kwd=eosc");
        });

        it("never produces a protocol-relative URL", () => {
            expect(trackedUrl("//evil.example/path", "")).toBe("/evil.example/path");
        });
    });

    describe("pageTitle", () => {
        it.each([
            ["/", "Home"],
            ["/search", "Search results"],
            ["/chat", "AI Mode"],
            ["/chat/b63fadcbb5af4636", "AI Mode"],
            ["/chat/b63fadcbb5af4636/export", "AI Mode export"],
            ["/dataplayer", "Data Player"],
            ["/profile", "API Keys"],
            ["/privacy-policy", "Privacy policy"],
            ["/acceptable-use-policy", "Acceptable use policy"],
            ["/no/such/page", "Not found"],
        ])("names %s as %s", (pathname, expected) => {
            expect(pageTitle(pathname)).toBe(expected);
        });
    });

    describe("analyticsEnabled", () => {
        it.each(["localhost", "app.localhost", "127.0.0.1", "[::1]"])("is off on %s", (host) => {
            expect(analyticsEnabled(host, "")).toBe(false);
        });

        it("is on for a deployed host by default", () => {
            expect(analyticsEnabled("matchmaker.eosc-data-commons.eu", "")).toBe(true);
            expect(analyticsEnabled("dev.matchmaker.eosc-data-commons.eu", "")).toBe(true);
        });

        it("remembers an opt-out until it is undone", () => {
            expect(analyticsEnabled("matchmaker.eosc-data-commons.eu", "?analytics=off")).toBe(false);
            expect(analyticsEnabled("matchmaker.eosc-data-commons.eu", "?q=ocean")).toBe(false);
            expect(analyticsEnabled("matchmaker.eosc-data-commons.eu", "?analytics=on")).toBe(true);
            expect(analyticsEnabled("matchmaker.eosc-data-commons.eu", "")).toBe(true);
        });
    });

    describe("onceInSession", () => {
        it("is true the first time and false after", () => {
            expect(onceInSession("signedIn")).toBe(true);
            expect(onceInSession("signedIn")).toBe(false);
            expect(onceInSession("other")).toBe(true);
        });
    });

    describe("datasetEventName", () => {
        it("names the context and the repository code in lower case", () => {
            expect(datasetEventName("search", hit({_repo: "ZENODO"}))).toBe("search:zenodo");
        });

        it("prefers the aggregator over the owning institution", () => {
            const aggregated = hit({
                _repo: "ONE",
                creators: [{
                    creatorName: "The Bgee Team",
                    nameType: "Organizational",
                    nameIdentifiers: [{nameIdentifierScheme: "URL", nameIdentifier: "https://www.bgee.org/"}],
                }],
            } as Partial<BackendDataset["_source"]>);
            expect(datasetEventName("ai_cited", aggregated)).toBe("ai_cited:one");
        });

        it("falls back to unknown when the source has no repository", () => {
            expect(datasetEventName("export", hit({}))).toBe("export:unknown");
        });
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
