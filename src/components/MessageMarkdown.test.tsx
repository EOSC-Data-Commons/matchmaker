import {describe, it, expect} from "vitest";
import {render, screen} from "@testing-library/react";
import {MemoryRouter} from "react-router";
import {makeDataset} from "@/test/fixtures/datasets";
import type {BackendDataset} from "@/types/commons";
import {normalizeDatasetUrl} from "@/lib/datasetCitations";
import {MessageMarkdown} from "./MessageMarkdown";

const DATASET_URL = "https://doi.org/10.5281/zenodo.1234567";
const hit = makeDataset({dataset_url: DATASET_URL, title: "Ocean Temperatures 2023"});
const datasets = new Map<string, BackendDataset>([[normalizeDatasetUrl(DATASET_URL), hit]]);

const renderMarkdown = (text: string, streaming = false) => render(
    // SearchResultItem (rendered by a dataset citation) reads the search params.
    <MemoryRouter><MessageMarkdown text={text} datasets={datasets} streaming={streaming}/></MemoryRouter>,
);

describe("MessageMarkdown", () => {
    it("renders a link to a known dataset as a citation chip", () => {
        renderMarkdown(`See [Ocean temps](${DATASET_URL}) for details.`);
        expect(screen.getByRole("button", {name: /Ocean temps/})).toBeInTheDocument();
        expect(screen.queryByRole("link")).not.toBeInTheDocument();
    });

    it("renders an unknown link as a safe external link", () => {
        renderMarkdown("See [the docs](https://example.org/docs).");
        const link = screen.getByRole("link", {name: "the docs"});
        expect(link).toHaveAttribute("href", "https://example.org/docs");
        expect(link).toHaveAttribute("target", "_blank");
        expect(link).toHaveAttribute("rel", "noopener noreferrer");
    });

    it("drops a link with a non-http scheme, keeping its label", () => {
        const {container} = renderMarkdown("Careful: [click me](javascript:alert(1)) here.");
        expect(screen.queryByRole("link")).not.toBeInTheDocument();
        // Only the label survives — the unsafe href is dropped entirely.
        expect(container.textContent).toContain("click me");
        expect(container.innerHTML).not.toContain("javascript:");
    });

    it("renders bold text, bold links and list markers", () => {
        renderMarkdown("- **important**\n1. **[the docs](https://example.org/docs)**");
        expect(screen.getByText("important").tagName).toBe("STRONG");
        expect(screen.getByRole("link", {name: "the docs"}).className).toContain("font-semibold");
        expect(screen.getByText("•")).toBeInTheDocument();
        expect(screen.getByText("1.")).toBeInTheDocument();
    });

    it("hides a trailing partial link only while streaming", () => {
        renderMarkdown("Found [Ocean te", true);
        expect(screen.getByText("Found")).toBeInTheDocument();
        expect(screen.queryByText(/Ocean te/)).not.toBeInTheDocument();

        renderMarkdown("Found [Ocean te", false);
        expect(screen.getByText(/Found \[Ocean te/)).toBeInTheDocument();
    });
});
