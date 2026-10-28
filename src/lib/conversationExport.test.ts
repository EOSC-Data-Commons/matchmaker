import {afterEach, describe, expect, it, vi} from "vitest";
import {makeDataset} from "@/test/fixtures/datasets";
import type {Message} from "@/types/chat";
import {buildDatasetUrlMap, collectCitations} from "@/lib/datasetCitations";
import {AI_DISCLAIMER, FUNDING_STATEMENT} from "@/lib/branding";
import {
    conversationToMarkdown,
    demoteHeadings,
    downloadConversationMarkdown,
    escapeMarkdown,
    exportFileName,
    formatExportDate,
    markCitations,
    messageBlocks,
    referenceEntries,
    toolCallSummary,
} from "./conversationExport";

const OCEAN_URL = "https://doi.org/10.5281/zenodo.1111111";
const ICE_URL = "https://doi.org/10.5281/zenodo.2222222";
const ocean = makeDataset({
    _id: OCEAN_URL,
    dataset_url: OCEAN_URL,
    title: "Ocean Temperatures 2023",
    _source: {titles: [{title: "Ocean Temperatures 2023"}], _repo: "ZENODO"},
});
const ice = makeDataset({
    _id: ICE_URL,
    dataset_url: ICE_URL,
    title: "Arctic Sea Ice",
    _source: {titles: [{title: "Arctic Sea Ice"}], _repo: "ZENODO"},
});

// Midday, so no time zone moves the date onto a neighbouring day.
const EXPORTED_AT = new Date(2026, 9, 28, 12, 0, 0);
const OPTIONS = {origin: "https://matchmaker.example", exportedAt: EXPORTED_AT, version: "0.12.0"};

const thread: Message[] = [
    {sender: "user", content: "Which datasets cover ocean_temperature and sea ice?"},
    {
        sender: "bot",
        content: "",
        blocks: [
            {kind: "text", text: "Let me search.\n\n\n\n"},
            {
                kind: "tool",
                toolCall: {
                    id: "c1",
                    name: "search_data",
                    args: '{"query":"ocean temperature sea ice","filters":{"year":2023}}',
                    hits: [ocean, ice],
                    totalFound: 120,
                    done: true,
                },
            },
            {
                kind: "text",
                text: [
                    "# Results",
                    `**[Ocean temps](${OCEAN_URL})** has the temperatures and [Arctic ice](${ICE_URL}) the ice.`,
                    `Again, [the ocean one](${OCEAN_URL}). See also [the docs](https://example.org/docs).`,
                    "",
                    "| Dataset | Year |",
                    "|---|---:|",
                    "| Ocean | 2023 |",
                ].join("\n"),
            },
        ],
    },
    {sender: "user", content: "And files?"},
    {sender: "bot", content: "Something went wrong while searching. Please try again.", isError: true},
];

describe("messageBlocks", () => {
    it("treats a message without blocks as one text block", () => {
        expect(messageBlocks({sender: "bot", content: "Hello"})).toEqual([{kind: "text", text: "Hello"}]);
        expect(messageBlocks({sender: "bot", content: ""})).toEqual([]);
    });
});

describe("formatExportDate and exportFileName", () => {
    it("spells out the month", () => {
        expect(formatExportDate(EXPORTED_AT)).toBe("28 October 2026");
    });

    it("reduces the title to an ASCII slug and adds the day", () => {
        expect(exportFileName("Süßwasser-Planarien in Deutschland, 1800 bis heute?", EXPORTED_AT))
            .toBe("eosc-data-commons-conversation-susswasser-planarien-in-deutschland-1800-bis-heute-2026-10-28.md");
    });

    it("keeps the slug short and falls back for a title with no letters", () => {
        const long = exportFileName("a ".repeat(80), EXPORTED_AT);
        expect(long).toMatch(/^eosc-data-commons-conversation-[a-z-]{1,60}-2026-10-28\.md$/);
        expect(long).not.toMatch(/--2026/);
        expect(exportFileName("???", EXPORTED_AT)).toBe("eosc-data-commons-conversation-untitled-2026-10-28.md");
    });
});

describe("toolCallSummary", () => {
    it("shows a search with its arguments verbatim and its result count", () => {
        const summary = toolCallSummary({
            id: "c1",
            name: "search_data",
            args: '{"query":"ocean"}',
            hits: [ocean],
            done: true
        });
        expect(summary.label).toBe("Searched datasets");
        expect(summary.count).toBe("1 result");
        expect(JSON.parse(summary.json)).toEqual({tool: "search_data", arguments: {query: "ocean"}, results: 1});
    });

    it("counts the files of a file listing", () => {
        const output = JSON.stringify({files: [{name: "a.nc", link: "x"}, {name: "b.nc", link: "y"}]});
        const summary = toolCallSummary({id: "c2", name: "get_dataset_files", args: '{"handle":"10.1/x"}', output});
        expect(summary.count).toBe("2 files");
        expect(JSON.parse(summary.json)).toEqual({
            tool: "get_dataset_files",
            arguments: {handle: "10.1/x"},
            results: 2
        });
    });

    it("names an unknown tool by itself, without a count or its output", () => {
        const summary = toolCallSummary({id: "c3", name: "get_metadata", args: "", output: "x".repeat(5000)});
        expect(summary.label).toBe("get_metadata");
        expect(summary.count).toBeNull();
        expect(JSON.parse(summary.json)).toEqual({tool: "get_metadata", arguments: {}});
    });

    it("keeps arguments that are not valid JSON as the raw string", () => {
        const summary = toolCallSummary({id: "c4", name: "search_data", args: '{"query": "oce', hits: []});
        expect(JSON.parse(summary.json)).toEqual({tool: "search_data", arguments: '{"query": "oce', results: 0});
    });
});

describe("referenceEntries", () => {
    it("splits each APA citation from the link it ends with", () => {
        const datasets = buildDatasetUrlMap(thread);
        const [first] = referenceEntries(collectCitations(messageBlocks(thread[1]), datasets));
        expect(first.number).toBe(1);
        expect(first.citation).toBe("Doe, J., & Smith, J. (2023). Ocean Temperatures 2023 [Data set]. Zenodo.");
        expect(first.link).toBe(OCEAN_URL);
        expect(first.href).toBe(OCEAN_URL);
    });

    it("leaves a citation whole when there is no web link to split off", () => {
        const noLink = makeDataset({_id: "", dataset_url: null, _source: {doi: null}});
        const [entry] = referenceEntries([{number: 1, dataset: noLink}]);
        expect(entry.link).toBeNull();
        expect(entry.href).toBeNull();
        expect(entry.citation).toContain("Test Dataset Title");
    });
});

describe("escapeMarkdown", () => {
    it("escapes markup but not an underscore inside a word", () => {
        expect(escapeMarkdown("*bold* [x](y) `c` <b> _emph_ ERA5_Land"))
            .toBe("\\*bold\\* [x\\](y) \\`c\\` \\<b\\> \\_emph\\_ ERA5_Land");
    });

    it("leaves brackets alone unless they would make a link", () => {
        expect(escapeMarkdown("Title [Data set]. [a][b] [c]: d")).toBe("Title [Data set]. [a\\][b] [c\\]: d");
    });

    it("stops a line from turning into a heading, list or quote", () => {
        expect(escapeMarkdown("# not a heading\n- not a list\n> no quote\n1. no list"))
            .toBe("\\# not a heading\n\\- not a list\n\\> no quote\n1\\. no list");
    });
});

describe("demoteHeadings", () => {
    it("moves headings two levels down, never past six, and leaves code alone", () => {
        const text = "# One\n#### Four\n###### Six\n####### Seven\n```\n# code\n```\n#hashtag";
        expect(demoteHeadings(text)).toBe("### One\n###### Four\n###### Six\n####### Seven\n```\n# code\n```\n#hashtag");
    });
});

describe("markCitations", () => {
    const datasets = buildDatasetUrlMap(thread);
    const citations = collectCitations(messageBlocks(thread[1]), datasets);

    it("numbers links to cited datasets in the order the screen does", () => {
        const text = `[a](${ICE_URL}) then **[b](${OCEAN_URL})** and [c](https://example.org)`;
        expect(markCitations(text, datasets, citations))
            .toBe(`[2] [a](${ICE_URL}) then **[1] [b](${OCEAN_URL})** and [c](https://example.org)`);
    });

    it("marks only the link itself after an earlier bracket", () => {
        expect(markCitations(`[note] see [it](${OCEAN_URL})`, datasets, citations))
            .toBe(`[note] see [1] [it](${OCEAN_URL})`);
    });

    it("leaves an image alone", () => {
        expect(markCitations(`![chart](${OCEAN_URL})`, datasets, citations)).toBe(`![chart](${OCEAN_URL})`);
    });
});

describe("conversationToMarkdown", () => {
    const markdown = conversationToMarkdown({title: "Ocean *and* ice", messages: thread}, OPTIONS);

    it("opens with the title, the logo, and where and when it was exported", () => {
        expect(markdown.startsWith([
            "# Ocean \\*and\\* ice",
            "![EOSC Data Commons](https://matchmaker.example/data-commons-icon-blue.png)",
            "AI Mode conversation, exported on 28 October 2026 from [EOSC Data Commons](https://matchmaker.example).",
            "---",
            "## Question",
        ].join("\n\n"))).toBe(true);
    });

    it("has no byline unless a name is given", () => {
        expect(markdown).not.toContain("Exported by");
        const signed = conversationToMarkdown({title: "t", messages: thread}, {...OPTIONS, author: "Jane Doe"});
        expect(signed).toContain("from [EOSC Data Commons](https://matchmaker.example).\n\nExported by Jane Doe.\n\n---");
    });

    it("keeps the question as typed", () => {
        expect(markdown).toContain("## Question\n\nWhich datasets cover ocean_temperature and sea ice?");
    });

    it("shows each tool call as a label and a JSON block, in place", () => {
        expect(markdown).toContain([
            "## Answer",
            "Let me search.",
            "**Searched datasets**, 2 results",
            "```json\n" + JSON.stringify({
                tool: "search_data",
                arguments: {query: "ocean temperature sea ice", filters: {year: 2023}},
                results: 2,
            }, null, 2) + "\n```",
            "### Results",
        ].join("\n\n"));
    });

    it("keeps the answer's own Markdown, with citation numbers and demoted headings", () => {
        expect(markdown).toContain(`**[1] [Ocean temps](${OCEAN_URL})** has the temperatures and [2] [Arctic ice](${ICE_URL}) the ice.`);
        expect(markdown).toContain(`Again, [1] [the ocean one](${OCEAN_URL}). See also [the docs](https://example.org/docs).`);
        expect(markdown).toContain("| Dataset | Year |\n|---|---:|\n| Ocean | 2023 |");
    });

    it("lists the cited datasets with the numbers used in the text", () => {
        expect(markdown).toContain([
            "**Datasets cited in this answer**",
            `1. Doe, J., & Smith, J. (2023). Ocean Temperatures 2023 [Data set]. Zenodo. <${OCEAN_URL}>\n`
            + `2. Doe, J., & Smith, J. (2023). Arctic Sea Ice [Data set]. Zenodo. <${ICE_URL}>`,
        ].join("\n\n"));
    });

    it("keeps an error in the thread as an error", () => {
        expect(markdown).toContain("## Question\n\nAnd files?\n\n## Answer\n\n> Error: Something went wrong while searching. Please try again.");
    });

    it("ends with the branding, the disclaimer, the funding line and the version", () => {
        expect(markdown.endsWith([
            "---",
            "Generated with EOSC Data Commons AI Mode, <https://matchmaker.example>",
            AI_DISCLAIMER,
            FUNDING_STATEMENT,
            "Version 0.12.0.",
        ].join("\n\n") + "\n")).toBe(true);
    });

    it("fences a JSON block longer than any backticks the arguments contain", () => {
        const withTicks: Message[] = [{
            sender: "bot",
            content: "",
            blocks: [{kind: "tool", toolCall: {id: "c9", name: "search_data", args: '{"query":"```x```"}', hits: []}}],
        }];
        const md = conversationToMarkdown({title: "t", messages: withTicks}, OPTIONS);
        expect(md).toContain('````json\n{\n  "tool": "search_data",\n  "arguments": {\n    "query": "```x```"\n  },\n  "results": 0\n}\n````');
    });
});

describe("downloadConversationMarkdown", () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("saves the Markdown under the export file name", async () => {
        let saved: Blob | null = null;
        vi.spyOn(URL, "createObjectURL").mockImplementation(blob => {
            saved = blob as Blob;
            return "blob:export";
        });
        vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {
        });
        const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
            expect(this.download).toBe("eosc-data-commons-conversation-ocean-2026-10-28.md");
            expect(this.isConnected).toBe(true);
        });

        downloadConversationMarkdown({title: "Ocean", messages: thread}, OPTIONS);

        expect(click).toHaveBeenCalledTimes(1);
        expect(saved).not.toBeNull();
        expect(await saved!.text()).toBe(conversationToMarkdown({title: "Ocean", messages: thread}, OPTIONS));
        expect(document.querySelector("a[download]")).toBeNull();
    });
});
