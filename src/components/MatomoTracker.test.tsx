import {describe, it, expect, beforeEach, afterEach} from "vitest";
import {act, render} from "@testing-library/react";
import {createMemoryRouter, RouterProvider} from "react-router";
import MatomoTracker from "./MatomoTracker";

type Paq = Array<Array<string | number | boolean>>;
const paq = () => window._paq as unknown as Paq;
/** Just the actions, ignoring setCustomUrl and the one-time tracker setup. */
const actions = () => paq().filter(c => c[0] === "trackPageView" || c[0] === "trackSiteSearch");

/** Mounts the tracker at `from`, then walks the router through `then`. */
const visit = async (from: string, then: string[] = []) => {
    const router = createMemoryRouter(
        [{path: "*", element: <MatomoTracker/>}],
        {initialEntries: [from]},
    );
    render(<RouterProvider router={router}/>);
    for (const url of then) {
        await act(async () => {
            await router.navigate(url);
        });
    }
};

describe("MatomoTracker", () => {
    beforeEach(() => {
        window._paq = [];
    });

    afterEach(() => {
        delete (window as Partial<Window>)._paq;
    });

    it("tracks a pageview on an ordinary route", async () => {
        await visit("/chat");
        expect(actions()).toEqual([["trackPageView"]]);
    });

    // Has to precede the first tracking call, or that call sets the cookie.
    it("turns cookies off before anything is tracked", async () => {
        await visit("/chat");
        expect(paq()[0]).toEqual(["disableCookies"]);
    });

    // Tests run on localhost, which is one of the hosts that never send.
    it("does not load matomo.js on a local dev server", async () => {
        await visit("/chat");
        expect(paq().some(c => c[0] === "setSiteId")).toBe(false);
    });

    it("reports a normalised URL and a stable title for the page", async () => {
        await visit("/chat/b63fadcbb5af4636a61cc90b6b4a8a83");
        expect(paq()).toContainEqual(["setCustomUrl", "/chat/:id"]);
        expect(paq()).toContainEqual(["setDocumentTitle", "AI Mode"]);
    });

    // Links rendered by the new route were not there when the first
    // enableLinkTracking ran on load.
    it("re-enables link tracking after each pageview", async () => {
        await visit("/", ["/chat"]);
        const commands = paq().map(c => c[0]);
        const lastPageView = commands.lastIndexOf("trackPageView");
        expect(commands.slice(lastPageView)).toContain("enableLinkTracking");
    });

    // useSearchResults reports this one with its hit count. A pageview here too
    // would double-count the action.
    it("holds back the pageview on a results page so the search can report it", async () => {
        await visit("/search?q=ocean");
        expect(actions()).toEqual([]);
    });

    it("still tracks a pageview when the results page has no query", async () => {
        await visit("/search?q=");
        expect(actions()).toEqual([["trackPageView"]]);
    });

    // Filtering is client-side and the Search/filter_* events record it. A
    // pageview here would be filed by Matomo as another search for the keyword.
    it("sends nothing when only the filters change", async () => {
        await visit("/search?q=ocean", ["/search?q=ocean&creator=Doe"]);
        expect(actions()).toEqual([]);
    });

    it("holds back the pageview again for a genuinely new keyword", async () => {
        await visit("/search?q=ocean", ["/search?q=climate"]);
        expect(actions()).toEqual([]);
    });

    // Leaving clears the remembered keyword, so coming back is a fresh search
    // that useSearchResults will report rather than a repeat to be counted here.
    it("suppresses a repeat of the same search after navigating away", async () => {
        await visit("/search?q=ocean", ["/chat", "/search?q=ocean"]);
        expect(actions()).toEqual([["trackPageView"]]);
    });
});
