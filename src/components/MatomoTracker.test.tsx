import {describe, it, expect, beforeEach, afterEach} from "vitest";
import {act, render} from "@testing-library/react";
import {createMemoryRouter, RouterProvider} from "react-router";
import MatomoTracker from "./MatomoTracker";

type Paq = Array<Array<string | number>>;
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

    // Filtering is client-side, so useSearchResults does not re-run. Suppressing
    // here would lose the action entirely.
    it("tracks a pageview when only the filters change", async () => {
        await visit("/search?q=ocean", ["/search?q=ocean&creator=Doe"]);
        expect(actions()).toEqual([["trackPageView"]]);
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
