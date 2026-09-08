import {describe, it, expect} from "vitest";
import {render} from "@testing-library/react";
import {MemoryRouter} from "react-router";
import {makeDataset} from "@/test/fixtures/datasets";
import {normalizeDatasetUrl} from "@/lib/datasetCitations";
import type {Message} from "@/types/chat";
import {BotMessageBody} from "./BotMessageBody";

const DATASET_URL = "https://doi.org/10.5281/zenodo.1234567";
const datasets = new Map([[normalizeDatasetUrl(DATASET_URL), makeDataset({dataset_url: DATASET_URL})]]);

const message = (isStreaming: boolean): Message => ({
    sender: "bot",
    content: "",
    isStreaming,
    blocks: [
        {kind: "text", text: "Looking."},
        {kind: "tool", toolCall: {id: "c1", name: "search_data", args: "", done: true}},
        {kind: "text", text: `Found [it](${DATASET_URL}).`},
    ],
});

const renderBody = (msg: Message) => render(
    <MemoryRouter><BotMessageBody message={msg} datasets={datasets} isLoggedIn={false}/></MemoryRouter>,
);

describe("BotMessageBody", () => {
    it("marks the end of the newest text only while the answer streams", () => {
        const {container} = renderBody(message(true));
        const anchors = container.querySelectorAll("[data-streaming-end]");
        expect(anchors).toHaveLength(1);
        // After the last text block, not the first one.
        expect(anchors[0].previousElementSibling?.textContent).toContain("Found");
    });

    it("has no streaming mark once the answer has ended", () => {
        const {container} = renderBody(message(false));
        expect(container.querySelector("[data-streaming-end]")).toBeNull();
    });
});
