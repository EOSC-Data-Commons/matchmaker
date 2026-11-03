import {describe, it, expect, vi} from "vitest";
import {renderHook, waitFor, act} from "@testing-library/react";
import {delay, http, HttpResponse} from "msw";
import {server} from "@/test/msw/server";
import {useSearchTextToQueryTool} from "./useDataplayerHooks";

describe("useSearchTextToQueryTool", () => {
    const tool = (name: string) => ({[name]: {name, description: "", slots: [], kind: "slots_only"}});

    it("starts idle with no query and no results", () => {
        const {result} = renderHook(() => useSearchTextToQueryTool());
        expect(result.current.activeSearch).toBe("");
        expect(result.current.searchStatus).toBe("idle");
        expect(result.current.queryToolResults).toEqual({});
    });

    it("sends nothing for a query the registry would reject as too short", async () => {
        const hit = vi.fn();
        server.use(http.get("/api/coordinator/tool/search", () => {
            hit();
            return HttpResponse.json({});
        }));
        const {result} = renderHook(() => useSearchTextToQueryTool());

        await act(() => result.current.search(" a "));

        expect(hit).not.toHaveBeenCalled();
        expect(result.current.activeSearch).toBe("");
        expect(result.current.searchStatus).toBe("idle");
    });

    it("searches the trimmed query on submit", async () => {
        const seen: string[] = [];
        server.use(http.get("/api/coordinator/tool/search", ({request}) => {
            seen.push(new URL(request.url).searchParams.get("q") ?? "");
            return HttpResponse.json({...tool("JupyterLab"), ...tool("Jupyter Notebook")});
        }));
        const {result} = renderHook(() => useSearchTextToQueryTool());

        act(() => {
            void result.current.search("  jupyter ");
        });
        expect(result.current.activeSearch).toBe("jupyter");
        expect(result.current.searchStatus).toBe("loading");

        await waitFor(() => expect(result.current.searchStatus).toBe("loaded"));
        expect(seen).toEqual(["jupyter"]);
        expect(Object.keys(result.current.queryToolResults)).toEqual(["JupyterLab", "Jupyter Notebook"]);
    });

    it("lets a later submission win over an earlier one that answers late", async () => {
        server.use(http.get("/api/coordinator/tool/search", async ({request}) => {
            const q = new URL(request.url).searchParams.get("q");
            if (q === "slow") {
                await delay(50);
                return HttpResponse.json(tool("Slow"));
            }
            return HttpResponse.json(tool("Fast"));
        }));
        const {result} = renderHook(() => useSearchTextToQueryTool());

        act(() => {
            void result.current.search("slow");
            void result.current.search("fast");
        });

        await waitFor(() => expect(result.current.searchStatus).toBe("loaded"));
        await delay(80);
        expect(result.current.activeSearch).toBe("fast");
        expect(Object.keys(result.current.queryToolResults)).toEqual(["Fast"]);
    });

    it("clearing the query drops the results and any error without a request", async () => {
        server.use(http.get("/api/coordinator/tool/search", () => new HttpResponse(null, {status: 503})));
        const {result} = renderHook(() => useSearchTextToQueryTool());

        await act(() => result.current.search("python"));
        expect(result.current.searchStatus).toBe("error");
        expect(result.current.searchError).toMatch(/unavailable/);

        server.resetHandlers();
        await act(() => result.current.search(""));

        expect(result.current.activeSearch).toBe("");
        expect(result.current.searchStatus).toBe("idle");
        expect(result.current.searchError).toBeNull();
        expect(result.current.queryToolResults).toEqual({});
    });
});
