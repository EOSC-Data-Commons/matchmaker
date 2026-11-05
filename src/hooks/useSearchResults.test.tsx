import {describe, it, expect, vi, beforeEach, afterEach} from "vitest";
import type {ReactNode} from "react";
import {renderHook, act} from "@testing-library/react";
import {MemoryRouter, useLocation} from "react-router";
import {http, HttpResponse, delay} from "msw";
import {server} from "@/test/msw/server";
import {makeDataset} from "@/test/fixtures/datasets";
import {getSearchHistory} from "@/lib/history";
import {RateLimitError, ServerError} from "@/lib/api";
import {useSearchResults} from "./useSearchResults";

const wrapper = ({children}: {children: ReactNode}) => (
    <MemoryRouter initialEntries={["/search?q=ocean"]}>{children}</MemoryRouter>
);

// Render the hook alongside useLocation so navigation is observable
const renderSearch = (query: string, model?: string) =>
    renderHook(() => ({
        search: useSearchResults(query, model),
        location: useLocation(),
    }), {wrapper});

const searchResult = {total_found: 1, hits: [makeDataset()]};

type Paq = Array<Array<string | number | boolean>>;
const paq = () => window._paq as unknown as Paq;

describe("useSearchResults", () => {
    beforeEach(() => {
        localStorage.clear();
        window._paq = [];
        vi.spyOn(console, "error").mockImplementation(() => {});
        vi.spyOn(console, "log").mockImplementation(() => {});
    });

    afterEach(() => {
        vi.restoreAllMocks();
        delete (window as Partial<Window>)._paq;
    });

    it("delivers the results and records the search history", async () => {
        server.use(http.get("/api/search/search", () => HttpResponse.json(searchResult)));
        const {result} = renderSearch("ocean");

        expect(result.current.search.loading).toBe(true);
        await act(() => result.current.search.performSearch());

        expect(result.current.search.error).toBeNull();
        expect(result.current.search.results).toEqual(searchResult);
        expect(result.current.search.loading).toBe(false);
        expect(getSearchHistory()).toEqual(["ocean"]);
    });

    it("treats an empty result set as a normal response, not an error", async () => {
        server.use(http.get("/api/search/search", () => HttpResponse.json({total_found: 0, hits: []})));
        const {result} = renderSearch("nothing matches this");
        await act(() => result.current.search.performSearch());

        expect(result.current.search.error).toBeNull();
        expect(result.current.search.results).toEqual({total_found: 0, hits: []});
    });

    it("navigates home when the query is empty", async () => {
        const {result} = renderSearch("");
        await act(() => result.current.search.performSearch());
        expect(result.current.location.pathname).toBe("/");
    });

    it("exposes RateLimitError and does not record history", async () => {
        server.use(http.get("/api/search/search", () => new HttpResponse(null, {status: 429})));
        const {result} = renderSearch("ocean");
        await act(() => result.current.search.performSearch());

        expect(result.current.search.error).toBeInstanceOf(RateLimitError);
        expect(result.current.search.loading).toBe(false);
        expect(getSearchHistory()).toEqual([]);
    });

    it("exposes ServerError on a backend failure", async () => {
        server.use(http.get("/api/search/search", () => new HttpResponse(null, {status: 503})));
        const {result} = renderSearch("ocean");
        await act(() => result.current.search.performSearch());

        expect(result.current.search.error).toBeInstanceOf(ServerError);
        expect(result.current.search.results).toBeNull();
    });

    describe("analytics", () => {
        it("reports a success as a site search with the hit count and Search/completed with the model and latency", async () => {
            server.use(http.get("/api/search/search", () => HttpResponse.json(searchResult)));
            const {result} = renderSearch("ocean", "cesnet/mini");
            await act(() => result.current.search.performSearch());

            // The site search replaces the pageview MatomoTracker held back; the
            // keyword travels only there, never in an event name.
            expect(paq()).toEqual([
                ["trackSiteSearch", "ocean", "search", 1],
                ["trackEvent", "Search", "completed", "cesnet/mini", expect.any(Number)],
            ]);
        });

        it("defaults the reported model when the page passes none", async () => {
            server.use(http.get("/api/search/search", () => HttpResponse.json({total_found: 0, hits: []})));
            const {result} = renderSearch("nothing matches this");
            await act(() => result.current.search.performSearch());

            expect(paq()).toEqual([
                ["trackSiteSearch", "nothing matches this", "search", 0],
                ["trackEvent", "Search", "completed", "cesnet/agentic", expect.any(Number)],
            ]);
        });

        it("reports a failure by kind and sends the held-back pageview instead of a site search", async () => {
            server.use(http.get("/api/search/search", () => new HttpResponse(null, {status: 429})));
            const {result} = renderSearch("ocean");
            await act(() => result.current.search.performSearch());

            expect(paq()).toEqual([
                ["trackEvent", "Search", "failed", "rate_limit"],
                ["trackPageView"],
            ]);
        });
    });

    it("ignores a second performSearch while one is in flight", async () => {
        let hits = 0;
        server.use(http.get("/api/search/search", async () => {
            hits++;
            await delay(30);
            return HttpResponse.json(searchResult);
        }));
        const {result} = renderSearch("ocean");

        await act(async () => {
            const first = result.current.search.performSearch();
            const second = result.current.search.performSearch();
            await Promise.all([first, second]);
        });
        expect(hits).toBe(1);
    });
});
