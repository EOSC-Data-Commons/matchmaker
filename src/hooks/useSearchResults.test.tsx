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
const renderSearch = (query: string) =>
    renderHook(() => ({
        search: useSearchResults(query),
        location: useLocation(),
    }), {wrapper});

const searchResult = {total_found: 1, hits: [makeDataset()]};

describe("useSearchResults", () => {
    beforeEach(() => {
        localStorage.clear();
        vi.spyOn(console, "error").mockImplementation(() => {});
        vi.spyOn(console, "log").mockImplementation(() => {});
    });

    afterEach(() => {
        vi.restoreAllMocks();
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
