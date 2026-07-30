import {describe, it, expect, vi, beforeEach} from "vitest";
import {render, screen, waitFor} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {MemoryRouter, Route, Routes} from "react-router";
import {http, HttpResponse} from "msw";
import {server} from "@/test/msw/server";
import {makeDataset} from "@/test/fixtures/datasets";
import {sse, sseResponse} from "@/test/sse";
import ChatPage from "./ChatPage";

const DATASET_URL = "https://doi.org/10.5281/zenodo.1234567";
const hit = makeDataset({dataset_url: DATASET_URL, title: "Ocean Temperatures 2023"});

// One assistant turn: a search tool call, then a streamed answer citing the hit
// as a plain Markdown link plus an unrelated external link.
const chatRun = sse([
    {type: "RUN_STARTED", thread_id: "t-1"},
    {type: "TOOL_CALL_START", tool_call_id: "c1", tool_call_name: "search_data"},
    {type: "TOOL_CALL_ARGS", tool_call_id: "c1", delta: '{"query":"ocean"}'},
    {type: "TOOL_CALL_RESULT", tool_call_id: "c1", content: JSON.stringify({total_found: 1, hits: [hit]})},
    {type: "TOOL_CALL_END", tool_call_id: "c1"},
    {type: "TEXT_MESSAGE_START", message_id: "m1"},
    {type: "TEXT_MESSAGE_CHUNK", delta: "See [Ocean temps](https://doi.org/10.5281/zenodo.1234567) "},
    {type: "TEXT_MESSAGE_CHUNK", delta: "and [the docs](https://example.org/docs)."},
    {type: "TEXT_MESSAGE_END", message_id: "m1"},
    {type: "RUN_FINISHED", thread_id: "t-1"},
]);

beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {
    });
    server.use(
        http.get("/auth/user", () => HttpResponse.json({sub: "u-1", name: "Jane Doe"})),
        http.get("/api/search/conversations", () => HttpResponse.json([])),
        http.post("/api/search/chat", () => sseResponse(chatRun)),
    );
});

// The real route mounts ChatPage on both /chat and /chat/:id — the run navigates to
// /chat/:thread_id as soon as RUN_STARTED arrives.
const renderChat = () => render(
    <MemoryRouter initialEntries={["/chat"]}>
        <Routes>
            <Route path="/chat" element={<ChatPage/>}/>
            <Route path="/chat/:id" element={<ChatPage/>}/>
        </Routes>
    </MemoryRouter>,
);

describe("ChatPage", () => {
    it("shows the tool call with its result count, its arguments and result cards", async () => {
        const user = userEvent.setup();
        renderChat();

        await user.type(await screen.findByRole("textbox"), "ocean data");
        await user.click(screen.getByRole("button", {name: /send/i}));

        const toolCall = await screen.findByRole("button", {name: /Searched datasets/});
        await waitFor(() => expect(toolCall).toHaveTextContent("1 result"));

        // Collapsed: no arguments and no result card yet.
        expect(screen.queryByText(/"query"/)).not.toBeInTheDocument();

        await user.click(toolCall);
        expect(screen.getByText(/"query": "ocean"/)).toBeInTheDocument();
        expect(screen.getByRole("heading", {name: "Ocean Temperatures 2023"})).toBeInTheDocument();
    });

    it("keeps what streamed before a terminal RUN_ERROR and adds an error bubble", async () => {
        server.use(http.post("/api/search/chat", () => sseResponse(sse([
            {type: "RUN_STARTED", thread_id: "t-2"},
            {type: "TEXT_MESSAGE_START", message_id: "m1"},
            {type: "TEXT_MESSAGE_CHUNK", delta: "Let me look that up."},
            {type: "RUN_ERROR", message: "LLM generation timed out"},
        ]))));
        const user = userEvent.setup();
        renderChat();

        await user.type(await screen.findByRole("textbox"), "ocean data");
        await user.click(screen.getByRole("button", {name: /send/i}));

        expect(await screen.findByText(/timed out/)).toBeInTheDocument();
        expect(screen.getByText("Let me look that up.")).toBeInTheDocument();
    });

    it("renders a cited dataset as an interactive reference and other links as plain links", async () => {
        const user = userEvent.setup();
        renderChat();

        await user.type(await screen.findByRole("textbox"), "ocean data");
        await user.click(screen.getByRole("button", {name: /send/i}));

        // Unmatched link: ordinary external anchor.
        const external = await screen.findByRole("link", {name: "the docs"});
        expect(external).toHaveAttribute("href", "https://example.org/docs");
        expect(external).toHaveAttribute("target", "_blank");
        expect(external).toHaveAttribute("rel", "noopener noreferrer");

        // Matched link: a chip that reveals the dataset card when clicked.
        const citation = await screen.findByRole("button", {name: /Ocean temps/});
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
        await user.click(citation);
        expect(await screen.findByRole("dialog")).toHaveTextContent("Ocean Temperatures 2023");
    });
});
