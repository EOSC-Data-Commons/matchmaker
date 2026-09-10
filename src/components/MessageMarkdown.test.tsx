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
        // Without the message's citations there is no number and nothing to jump to.
        expect(pill).not.toHaveTextContent("[");
    });

    it("carries the reference number in the pill and jumps to it when clicked", async () => {
        const onCite = vi.fn();
        renderMarkdown(`See [Ocean temps](${DATASET_URL}).`, false, [{number: 3, dataset: hit}], onCite);
        const pill = screen.getByRole("link", {name: /Ocean temps/});
        expect(pill).toHaveTextContent("[3]");
        expect(pill).toHaveAttribute("title", "Reference 3: Ocean Temperatures 2023 (Zenodo)");
        await userEvent.click(pill);
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

    // A blank line renders as an empty `min-h-6` paragraph, so unnormalized padding
    // around the agent's text showed up as large white gaps between tool calls.
    it("keeps one blank line as a paragraph break and drops the rest", () => {
        const emptyParagraphs = (container: HTMLElement) =>
            Array.from(container.querySelectorAll("p")).filter(p => p.textContent === "").length;

        const padded = renderMarkdown("\n\nI'll search for datasets.\n\n\n\n").container;
        expect(padded.querySelectorAll("p")).toHaveLength(1);
        expect(emptyParagraphs(padded)).toBe(0);

        const runOfBlanks = renderMarkdown("First paragraph.\n\n\n\nSecond paragraph.").container;
        expect(emptyParagraphs(runOfBlanks)).toBe(1);

        // A single deliberate break still separates the two paragraphs.
        const singleBreak = renderMarkdown("First paragraph.\n\nSecond paragraph.").container;
        expect(emptyParagraphs(singleBreak)).toBe(1);
    });

    it("renders a pipe table as a real table, with dataset pills inside its cells", () => {
        const {container} = renderMarkdown(
            `| # | Dataset | Why |\n|---|:-------:|----:|\n| 1 | [Ocean temps](${DATASET_URL}) | Sea surface |\n| 2 | ERA5-Land | Precipitation |`
        );

        expect(container.querySelectorAll("table")).toHaveLength(1);
        // No pipes left over as literal text.
        expect(container.textContent).not.toContain("|");
        expect(container.textContent).not.toContain("---");

        const headers = Array.from(container.querySelectorAll("th")).map(th => th.textContent);
        expect(headers).toEqual(["#", "Dataset", "Why"]);
        expect(container.querySelectorAll("tbody tr")).toHaveLength(2);

        // Column alignment comes from the delimiter row.
        expect(container.querySelectorAll("th")[1].className).toContain("text-center");
        expect(container.querySelectorAll("th")[2].className).toContain("text-right");

        // A cell is still inline Markdown, so a cited dataset keeps its pill.
        const pill = screen.getByRole("link", {name: /Ocean temps/});
        expect(pill.closest("td")).not.toBeNull();
    });

    it("pads a ragged row so its cells stay under the right columns", () => {
        const {container} = renderMarkdown("| a | b | c |\n|---|---|---|\n| 1 | 2 |");
        const cells = Array.from(container.querySelectorAll("tbody td")).map(td => td.textContent);
        expect(cells).toEqual(["1", "2", ""]);
    });

    it("leaves a lone pipe line as prose: a table needs its delimiter row", () => {
        const {container} = renderMarkdown("Use | as the separator |");
        expect(container.querySelector("table")).toBeNull();
        expect(container.textContent).toContain("Use | as the separator |");
    });

    it("renders italics, inline code and headings instead of printing their markers", () => {
        const {container} = renderMarkdown("## Results\nan *italic* word and `t2m` code");
        expect(screen.getByText("italic").tagName).toBe("EM");
        expect(screen.getByText("t2m").tagName).toBe("CODE");
        expect(screen.getByText("Results").className).toContain("font-semibold");
        expect(container.textContent).not.toContain("*");
        expect(container.textContent).not.toContain("#");
    });

    // `**bold**` must not be read as an empty italic wrapping a stray asterisk.
    it("keeps bold bold when it sits next to italics, and leaves identifiers alone", () => {
        renderMarkdown("**bold** and *thin*\nthe total_precipitation variable");
        expect(screen.getByText("bold").tagName).toBe("STRONG");
        expect(screen.getByText("thin").tagName).toBe("EM");
        expect(screen.getByText(/total_precipitation/)).toBeInTheDocument();
    });

    it("hides a trailing partial link only while streaming", () => {
        renderMarkdown("Found [Ocean te", true);
        expect(screen.getByText("Found")).toBeInTheDocument();
        expect(screen.queryByText(/Ocean te/)).not.toBeInTheDocument();

        renderMarkdown("Found [Ocean te", false);
        expect(screen.getByText(/Found \[Ocean te/)).toBeInTheDocument();
    });
});
