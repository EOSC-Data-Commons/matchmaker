import {describe, it, expect, vi, beforeEach, afterEach} from "vitest";
import type {ReactNode} from "react";
import {renderHook, act} from "@testing-library/react";
import {MemoryRouter, useLocation} from "react-router";
import {http, HttpResponse, delay} from "msw";
import {server} from "@/test/msw/server";
import {sse, sseResponse} from "@/test/sse";
import {makeDataset} from "@/test/fixtures/datasets";
import {getSearchHistory} from "@/lib/history";
import {RateLimitError} from "@/lib/api";
import {useSearchResults} from "./useSearchResults";

const wrapper = ({children}: {children: ReactNode}) => (
    <MemoryRouter initialEntries={["/search?q=ocean"]}>{children}</MemoryRouter>
);

// Render the hook alongside useLocation so navigation is observable
const renderSearch = (query: string, model = "cesnet/agentic") =>
    renderHook(() => ({
        search: useSearchResults(query, model),
        location: useLocation(),
    }), {wrapper});

const initialResult = {hits: [makeDataset()], summary: "found"};
const rerankedResult = {hits: [makeDataset()], summary: "reranked"};

const successfulRun = sse([
    {type: "TOOL_CALL_START", tool_call_id: "c1", tool_call_name: "search_data"},
    {type: "TOOL_CALL_RESULT", tool_call_id: "c1", content: JSON.stringify(initialResult)},
    {type: "TOOL_CALL_START", tool_call_id: "c2", tool_call_name: "rerank_results"},
    {type: "TOOL_CALL_RESULT", tool_call_id: "c2", content: JSON.stringify(rerankedResult)},
    {type: "RUN_FINISHED"},
]);

describe("useSearchResults", () => {
    beforeEach(() => {
        localStorage.clear();
        vi.spyOn(console, "error").mockImplementation(() => {});
        vi.spyOn(console, "log").mockImplementation(() => {});
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("delivers initial and reranked results and records the search history", async () => {
        server.use(http.post("/api/search/chat", () => sseResponse(successfulRun)));
        const {result} = renderSearch("ocean");

        expect(result.current.search.loading).toBe(true);
        await act(() => result.current.search.performSearch());

        expect(result.current.search.error).toBeNull();
        expect(result.current.search.initialResults).toEqual(initialResult);
        expect(result.current.search.rerankedResults).toEqual(rerankedResult);
        expect(result.current.search.loading).toBe(false);
        expect(result.current.search.isProcessing).toBe(false);
        expect(getSearchHistory()).toEqual(["ocean"]);
    });

    it("navigates home when the query is empty", async () => {
        const {result} = renderSearch("");
        await act(() => result.current.search.performSearch());
        expect(result.current.location.pathname).toBe("/");
    });

    it("exposes RateLimitError and does not record history", async () => {
        server.use(http.post("/api/search/chat", () => new HttpResponse(null, {status: 429})));
        const {result} = renderSearch("ocean");
        await act(() => result.current.search.performSearch());

        expect(result.current.search.error).toBeInstanceOf(RateLimitError);
        expect(result.current.search.loading).toBe(false);
        expect(getSearchHistory()).toEqual([]);
    });

    it("surfaces RUN_ERROR events as an error state", async () => {
        server.use(http.post("/api/search/chat", () =>
            sseResponse(sse([{type: "RUN_ERROR", error: "model overloaded"}])),
        ));
        const {result} = renderSearch("ocean");
        await act(() => result.current.search.performSearch());
        expect(result.current.search.error?.message).toBe("model overloaded");
    });

    it("ignores a second performSearch while one is in flight", async () => {
        let hits = 0;
        server.use(http.post("/api/search/chat", async () => {
            hits++;
            await delay(30);
            return sseResponse(successfulRun);
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
