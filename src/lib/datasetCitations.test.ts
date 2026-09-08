import {describe, it, expect} from "vitest";
import {makeDataset} from "@/test/fixtures/datasets";
import type {SSEEvent} from "@/lib/api";
import type {Message, MessageBlock} from "@/types/chat";
import {applyChatEvent} from "./chatMessages";
import {buildDatasetUrlMap, collectCitations, lookupDataset, normalizeDatasetUrl} from "./datasetCitations";

const DATASET_URL = "https://doi.org/10.5281/zenodo.1234567";
const hit = makeDataset({dataset_url: DATASET_URL});
const searchPayload = JSON.stringify({total_found: 42, hits: [hit]});

const run = (events: SSEEvent[], messages: Message[] = []): Message[] =>
    events.reduce(applyChatEvent, messages);

describe("dataset URL resolution", () => {
    it("matches a citation link against the hit's dataset_url", () => {
        const messages = run([
            {type: "TOOL_CALL_START", tool_call_id: "c1", tool_call_name: "search_data"},
            {type: "TOOL_CALL_RESULT", tool_call_id: "c1", content: searchPayload},
        ]);
        const map = buildDatasetUrlMap(messages);

        expect(lookupDataset(map, DATASET_URL)?._id).toBe(hit._id);
        // Normalizations the model sometimes applies while copying a URL.
        expect(lookupDataset(map, "http://dx.doi.org/10.5281/ZENODO.1234567/")?._id).toBe(hit._id);
        expect(lookupDataset(map, "https://example.org/other")).toBeNull();
    });

    it("normalizes scheme, www, host case and trailing slash", () => {
        expect(normalizeDatasetUrl("HTTPS://WWW.Example.org/a/b/")).toBe("example.org/a/b");
        expect(normalizeDatasetUrl("not a url/")).toBe("not a url");
    });

    it("ignores hits without a dataset_url", () => {
        const messages = run([
            {type: "TOOL_CALL_START", tool_call_id: "c1", tool_call_name: "search_data"},
            {type: "TOOL_CALL_RESULT", tool_call_id: "c1", content: JSON.stringify({hits: [makeDataset()]})},
        ]);
        expect(buildDatasetUrlMap(messages).size).toBe(0);
    });
});

describe("collectCitations", () => {
    const SECOND_URL = "https://doi.org/10.5281/zenodo.7654321";
    const second = makeDataset({dataset_url: SECOND_URL, _id: SECOND_URL});
    const datasets = new Map([
        [normalizeDatasetUrl(DATASET_URL), hit],
        [normalizeDatasetUrl(SECOND_URL), second],
    ]);
    const text = (t: string): MessageBlock => ({kind: "text", text: t});

    it("numbers cited datasets by first mention across the message's text blocks", () => {
        const citations = collectCitations([
            text(`Start with [B](${SECOND_URL}) then **[A](${DATASET_URL})**.`),
            {kind: "tool", toolCall: {id: "c1", name: "search_data", args: ""}},
            // Repeats, one with the URL rewritten the way the model sometimes does.
            text(`Again [B](${SECOND_URL}) and [A](http://dx.doi.org/10.5281/ZENODO.1234567/).`),
        ], datasets);
        expect(citations.map(c => [c.number, c.dataset])).toEqual([[1, second], [2, hit]]);
    });

    it("ignores links that resolve to no search hit", () => {
        expect(collectCitations([text("See [the docs](https://example.org/docs).")], datasets)).toEqual([]);
    });

    it("does not count a link that is still streaming in", () => {
        const citations = collectCitations([text(`Found [A](${DATASET_URL}) and [B](https://doi.org/10.5281/zen`)], datasets);
        expect(citations.map(c => c.dataset)).toEqual([hit]);
    });
});
