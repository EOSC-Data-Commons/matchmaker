import {describe, it, expect, vi} from "vitest";
import {render, screen} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type {Aggregations} from "@/types/commons";
import {FilterPanel} from "./FilterPanel";

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
});
