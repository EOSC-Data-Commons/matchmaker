import {describe, expect, it} from "vitest";
import {render, screen, within} from "@testing-library/react";
import {makeDataset} from "@/test/fixtures/datasets";
import type {Message} from "@/types/chat";
import {AI_DISCLAIMER, FUNDING_STATEMENT} from "@/lib/branding";
import {ConversationExportView} from "./ConversationExportView";

const DATASET_URL = "https://doi.org/10.5281/zenodo.1234567";
const hit = makeDataset({
    _id: DATASET_URL,
    dataset_url: DATASET_URL,
    title: "Ocean Temperatures 2023",
    _source: {titles: [{title: "Ocean Temperatures 2023"}], _repo: "ZENODO"},
});

const messages: Message[] = [
    {sender: "user", content: "ocean data please"},
    {
        sender: "bot",
        content: "",
        blocks: [
            {
                kind: "tool",
                toolCall: {id: "c1", name: "search_data", args: '{"query":"ocean"}', hits: [hit], done: true},
            },
            {kind: "text", text: `See [Ocean temps](${DATASET_URL}) and [the docs](https://example.org/docs).`},
        ],
    },
    {sender: "user", content: "and files?"},
    {sender: "bot", content: "The search timed out.", isError: true},
];

const renderView = (author?: string) => render(
    <ConversationExportView
        title="Ocean conversation"
        messages={messages}
        origin="https://matchmaker.example"
        exportedAt={new Date(2026, 9, 28, 12)}
        version="0.12.0"
        author={author}
    />,
);

describe("ConversationExportView", () => {
    it("is branded, titled and dated, with no byline unless asked for", () => {
        renderView();
        expect(screen.getByRole("img", {name: "EOSC Data Commons"})).toBeInTheDocument();
        expect(screen.getByRole("heading", {level: 1, name: "Ocean conversation"})).toBeInTheDocument();
        expect(screen.getByText("Exported on 28 October 2026")).toBeInTheDocument();
        expect(screen.getAllByRole("link", {name: "https://matchmaker.example"})[0])
            .toHaveAttribute("href", "https://matchmaker.example/");
        expect(screen.queryByText(/Exported by/)).not.toBeInTheDocument();
    });

    it("names the exporter when given a name", () => {
        renderView("Jane Doe");
        expect(screen.getByText("Exported by Jane Doe")).toBeInTheDocument();
    });

    it("shows every turn under Question and Answer headings", () => {
        renderView();
        expect(screen.getAllByRole("heading", {level: 2, name: "Question"})).toHaveLength(2);
        expect(screen.getAllByRole("heading", {level: 2, name: "Answer"})).toHaveLength(2);
        expect(screen.getByText("ocean data please")).toBeInTheDocument();
        expect(screen.getByText("Error: The search timed out.")).toBeInTheDocument();
    });

    it("shows the tool call with its JSON", () => {
        renderView();
        expect(screen.getByText("Searched datasets")).toBeInTheDocument();
        expect(screen.getByText(", 1 result", {exact: false})).toBeInTheDocument();
        // Exact text, indentation included, so the block prints as readable JSON.
        expect(screen.getByText(/"query": "ocean"/).textContent).toBe(
            JSON.stringify({tool: "search_data", arguments: {query: "ocean"}, results: 1}, null, 2),
        );
    });

    it("keeps the numbered citation pill as a link to the dataset", () => {
        renderView();
        const pill = screen.getByRole("link", {name: /\[1].*Ocean temps/});
        expect(pill).toHaveAttribute("href", DATASET_URL);
        expect(screen.getByRole("link", {name: "the docs"})).toHaveAttribute("href", "https://example.org/docs");
    });

    it("lists the cited datasets as APA citations with their links", () => {
        renderView();
        const list = screen.getByRole("region", {name: "Datasets cited in this answer"});
        const [entry] = within(list).getAllByRole("listitem");
        expect(entry).toHaveTextContent("[1]Doe, J., & Smith, J. (2023). Ocean Temperatures 2023 [Data set]. Zenodo.");
        expect(within(entry).getByRole("link", {name: DATASET_URL})).toHaveAttribute("href", DATASET_URL);
    });

    it("ends with the disclaimer, the funding line and the version, and has no controls", () => {
        renderView();
        expect(screen.getByText(AI_DISCLAIMER)).toBeInTheDocument();
        expect(screen.getByText(FUNDING_STATEMENT)).toBeInTheDocument();
        expect(screen.getByText("Version 0.12.0")).toBeInTheDocument();
        expect(screen.queryByRole("button")).not.toBeInTheDocument();
    });
});
