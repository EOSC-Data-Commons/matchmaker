import {describe, it, expect, beforeEach, vi} from "vitest";
import {getSearchHistory, addToSearchHistory} from "./history";

describe("search history", () => {
    beforeEach(() => {
        localStorage.clear();
    });

    it("returns an empty array when nothing is stored", () => {
        expect(getSearchHistory()).toEqual([]);
    });

    it("adds queries to the front, newest first", () => {
        addToSearchHistory("first");
        addToSearchHistory("second");
        expect(getSearchHistory()).toEqual(["second", "first"]);
    });

    it("moves a repeated query to the front instead of duplicating it", () => {
        addToSearchHistory("a");
        addToSearchHistory("b");
        addToSearchHistory("a");
        expect(getSearchHistory()).toEqual(["a", "b"]);
    });

    it("keeps only the latest 5 queries", () => {
        for (const q of ["1", "2", "3", "4", "5", "6"]) addToSearchHistory(q);
        expect(getSearchHistory()).toEqual(["6", "5", "4", "3", "2"]);
    });

    it("ignores empty queries", () => {
        addToSearchHistory("");
        expect(getSearchHistory()).toEqual([]);
    });

    it("recovers from corrupted stored JSON without throwing", () => {
        localStorage.setItem("searchHistory", "{not json");
        const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {
        });
        expect(getSearchHistory()).toEqual([]);
        consoleSpy.mockRestore();
    });
});
