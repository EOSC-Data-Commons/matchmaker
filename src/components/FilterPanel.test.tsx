import {describe, it, expect, vi, beforeEach, afterEach} from "vitest";
import {render, screen} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type {Aggregations} from "@/types/commons";
import {FilterPanel} from "./FilterPanel";

type Paq = Array<Array<string | number | boolean>>;
const events = () => (window._paq as unknown as Paq).filter(c => c[0] === "trackEvent");

const aggregations: Aggregations = {
    publicationYear: {
        label: "Publication Year",
        buckets: [
            {key: "2023", label: "2023", doc_count: 1234},
            {key: "2021", label: "2021", doc_count: 7},
        ],
    },
    creator: {
        label: "Author",
        buckets: [{key: "Doe, Jane", label: "Doe, Jane", doc_count: 3}],
    },
};

describe("FilterPanel", () => {
    beforeEach(() => {
        window._paq = [];
    });

    afterEach(() => {
        delete (window as Partial<Window>)._paq;
    });

    it("opens the year section by default and keeps others collapsed", () => {
        render(
            <FilterPanel
                aggregations={aggregations}
                activeFilters={new URLSearchParams()}
                onFilterChange={() => {}}
            />,
        );
        expect(screen.getByLabelText("2023 (1,234)")).toBeInTheDocument();
        expect(screen.queryByLabelText(/Doe, Jane/)).not.toBeInTheDocument();
    });

    it("expands a collapsed section on click", async () => {
        const user = userEvent.setup();
        render(
            <FilterPanel
                aggregations={aggregations}
                activeFilters={new URLSearchParams()}
                onFilterChange={() => {}}
            />,
        );
        await user.click(screen.getByRole("button", {name: "Author"}));
        expect(screen.getByLabelText("Doe, Jane (3)")).toBeInTheDocument();
    });

    it("selecting a value appends it to the active filters", async () => {
        const user = userEvent.setup();
        const onFilterChange = vi.fn();
        render(
            <FilterPanel
                aggregations={aggregations}
                activeFilters={new URLSearchParams([["creator", "Doe, Jane"]])}
                onFilterChange={onFilterChange}
            />,
        );
        await user.click(screen.getByLabelText("2023 (1,234)"));

        const params: URLSearchParams = onFilterChange.mock.calls[0][0];
        expect(params.getAll("publicationYear")).toEqual(["2023"]);
        // Existing selections of other facets are preserved
        expect(params.getAll("creator")).toEqual(["Doe, Jane"]);
    });

    it("clicking a checked value removes only that value", async () => {
        const user = userEvent.setup();
        const onFilterChange = vi.fn();
        render(
            <FilterPanel
                aggregations={aggregations}
                activeFilters={new URLSearchParams([
                    ["publicationYear", "2023"],
                    ["publicationYear", "2021"],
                ])}
                onFilterChange={onFilterChange}
            />,
        );
        const checkbox = screen.getByLabelText("2023 (1,234)");
        expect(checkbox).toBeChecked();
        await user.click(checkbox);

        const params: URLSearchParams = onFilterChange.mock.calls[0][0];
        expect(params.getAll("publicationYear")).toEqual(["2021"]);
    });

    describe("analytics", () => {
        it("reports applying a filter by facet, with the active count as the value", async () => {
            const user = userEvent.setup();
            render(
                <FilterPanel
                    aggregations={aggregations}
                    activeFilters={new URLSearchParams([["creator", "Doe, Jane"]])}
                    onFilterChange={() => {}}
                />,
            );
            await user.click(screen.getByLabelText("2023 (1,234)"));

            // One author already active plus this year makes two.
            expect(events()).toEqual([["trackEvent", "Search", "filter_applied", "publicationYear", 2]]);
        });

        it("reports removing a filter and never the value, which can be an author name", async () => {
            const user = userEvent.setup();
            render(
                <FilterPanel
                    aggregations={aggregations}
                    activeFilters={new URLSearchParams([["creator", "Doe, Jane"], ["publicationYear", "2023"]])}
                    onFilterChange={() => {}}
                />,
            );
            await user.click(screen.getByRole("button", {name: "Author"}));
            await user.click(screen.getByLabelText("Doe, Jane (3)"));

            expect(events()).toEqual([["trackEvent", "Search", "filter_removed", "creator", 1]]);
            expect(JSON.stringify(window._paq)).not.toContain("Doe");
        });
    });
});
