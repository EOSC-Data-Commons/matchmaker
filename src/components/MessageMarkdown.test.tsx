import {describe, it, expect, vi} from "vitest";
import {render, screen} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {makeDataset} from "@/test/fixtures/datasets";
import type {BackendDataset} from "@/types/commons";
import {normalizeDatasetUrl, type DatasetCitation} from "@/lib/datasetCitations";
import {MessageMarkdown} from "./MessageMarkdown";

const DATASET_URL = "https://doi.org/10.5281/zenodo.1234567";
const hit = makeDataset({dataset_url: DATASET_URL, title: "Ocean Temperatures 2023", _source: {_repo: "Zenodo"}});
const datasets = new Map<string, BackendDataset>([[normalizeDatasetUrl(DATASET_URL), hit]]);

const renderMarkdown = (
    text: string,
    streaming = false,
    citations?: DatasetCitation[],
    onCite?: (number: number) => void,
) => render(
    <MessageMarkdown text={text} datasets={datasets} streaming={streaming} citations={citations} onCite={onCite}/>,
);

describe("MessageMarkdown", () => {
    it("renders a link to a known dataset as a pill linking to the source, tagged with its repository", () => {
        renderMarkdown(`See [Ocean temps](${DATASET_URL}) for details.`);
        const pill = screen.getByRole("link", {name: /Ocean temps/});
        expect(pill).toHaveAttribute("href", DATASET_URL);
        expect(pill).toHaveAttribute("target", "_blank");
        expect(pill).toHaveAttribute("rel", "noopener noreferrer");
        expect(pill).toHaveTextContent("Zenodo");
        // Without the message's citations there is no reference list to point at.
        expect(screen.queryByRole("button")).not.toBeInTheDocument();
    });

    it("follows a cited dataset with a [n] marker that reports its reference number", async () => {
        const onCite = vi.fn();
        renderMarkdown(`See [Ocean temps](${DATASET_URL}).`, false, [{number: 3, dataset: hit}], onCite);
        const marker = screen.getByRole("button", {name: "Reference 3: Ocean Temperatures 2023 (Zenodo)"});
        expect(marker).toHaveTextContent("[3]");
        await userEvent.click(marker);
        expect(onCite).toHaveBeenCalledWith(3);
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
