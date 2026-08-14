import {describe, it, expect} from "vitest";
import type {ReactNode} from "react";
import {render, screen} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {MemoryRouter} from "react-router";
import {makeDataset} from "@/test/fixtures/datasets";
import type {ToolCall} from "@/types/chat";
import {ToolCallEntry} from "./ToolCallEntry";

const wrapper = ({children}: {children: ReactNode}) => <MemoryRouter>{children}</MemoryRouter>;

const renderEntry = (toolCall: ToolCall) =>
    render(<ToolCallEntry toolCall={toolCall}/>, {wrapper});

/** A tool-registry hit, shaped as `search_tools` returns it. */
const makeToolHit = () => ({
    ...makeDataset(),
    _source: {
        url: "https://example.org/samtools",
        titles: [{title: "Samtools"}],
        descriptions: [{description: "Utilities for manipulating alignments in SAM format."}],
        resourceType: "tool",
    },
    title: "Samtools",
    description: "Utilities for manipulating alignments in SAM format.",
    dataset_url: "https://example.org/samtools",
    fileExtensions: ["bam", "sam"],
});

describe("ToolCallEntry", () => {
    it("labels the known tools instead of showing the raw name", () => {
        const {unmount} = renderEntry({id: "c1", name: "search_tools", args: "", hits: [], done: true});
        expect(screen.getByText("Searched tools")).toBeInTheDocument();
        unmount();

        renderEntry({id: "c2", name: "get_dataset_files", args: "", output: '{"files":[]}', done: true});
        expect(screen.getByText("Listed dataset files")).toBeInTheDocument();
    });

    it("falls back to the raw tool name for anything unknown", () => {
        renderEntry({id: "c1", name: "some_new_tool", args: "", output: "{}", done: true});
        expect(screen.getByText("some_new_tool")).toBeInTheDocument();
    });

    it("renders a tool hit as a tool card, not a dataset card", async () => {
        const user = userEvent.setup();
        renderEntry({id: "c1", name: "search_tools", args: "", hits: [makeToolHit()], done: true});

        await user.click(screen.getByRole("button"));

        expect(screen.getByText("Samtools")).toBeInTheDocument();
        expect(screen.getByRole("link", {name: /Open tool/})).toHaveAttribute("href", "https://example.org/samtools");
        // The dataset card's controls make no sense for a tool and must not appear.
        expect(screen.queryByText("Cite")).not.toBeInTheDocument();
        expect(screen.queryByText("Play")).not.toBeInTheDocument();
        // Input/output formats are the useful part of a tool result.
        expect(screen.getByText("bam")).toBeInTheDocument();
        expect(screen.getByText("sam")).toBeInTheDocument();
    });

    it("still renders dataset hits as dataset cards", async () => {
        const user = userEvent.setup();
        renderEntry({id: "c1", name: "search_data", args: "", hits: [makeDataset()], done: true});

        await user.click(screen.getByRole("button"));
        expect(screen.getByText("Cite")).toBeInTheDocument();
    });

    it("lists dataset files instead of dumping JSON", async () => {
        const user = userEvent.setup();
        const payload = JSON.stringify({
            files: [
                {name: "readme.txt", link: "https://example.org/readme.txt", size: 2048},
                {name: "data.csv", link: "https://example.org/data.csv", size: 5242880,
                    raw_metadata: {friendly_type: "Comma Separated Values"}},
            ],
        });
        renderEntry({id: "c1", name: "get_dataset_files", args: "", output: payload, done: true});

        expect(screen.getByText("· 2 files")).toBeInTheDocument();
        await user.click(screen.getByRole("button", {name: /Listed dataset files/}));

        expect(screen.getByText("readme.txt")).toBeInTheDocument();
        expect(screen.getByText("2.0 KB")).toBeInTheDocument();
        expect(screen.getByText("Comma Separated Values · 5.0 MB")).toBeInTheDocument();
        expect(screen.queryByText("Output")).not.toBeInTheDocument();
    });

    it("keeps the raw output fallback for unrecognised payloads", async () => {
        const user = userEvent.setup();
        renderEntry({id: "c1", name: "some_new_tool", args: "", output: '{"status":"ok"}', done: true});

        await user.click(screen.getByRole("button"));
        expect(screen.getByText("Output")).toBeInTheDocument();
    });
});
