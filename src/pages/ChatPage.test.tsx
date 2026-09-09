import {describe, it, expect, vi, beforeEach} from "vitest";
import {render, screen, waitFor, within} from "@testing-library/react";
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

    it("renders a cited dataset as a numbered reference with a list entry, and other links as plain links", async () => {
        const user = userEvent.setup();
        renderChat();

        await user.type(await screen.findByRole("textbox"), "ocean data");
        await user.click(screen.getByRole("button", {name: /send/i}));

        // Unmatched link: ordinary external anchor.
        const external = await screen.findByRole("link", {name: "the docs"});
        expect(external).toHaveAttribute("href", "https://example.org/docs");
        expect(external).toHaveAttribute("target", "_blank");
        expect(external).toHaveAttribute("rel", "noopener noreferrer");

        // Matched link: one pill carrying its [1] and linking to the source.
        const pill = await screen.findByRole("link", {name: /Ocean temps/});
        expect(pill).toHaveAttribute("href", DATASET_URL);
        expect(pill).toHaveTextContent("[1]");

        // The reference list under the answer carries the same number and the card's actions.
        const references = screen.getByRole("region", {name: "Datasets cited in this answer"});
        expect(within(references).getByText("[1]")).toBeInTheDocument();
        expect(within(references).getByText("Ocean Temperatures 2023")).toBeInTheDocument();
        expect(within(references).getByRole("link", {name: /source of dataset Ocean Temperatures 2023/}))
            .toHaveAttribute("href", hit._id);
    });

    it("copies a user message to the clipboard", async () => {
        const user = userEvent.setup();
        renderChat();

        await user.type(await screen.findByRole("textbox"), "ocean data");
        await user.click(screen.getByRole("button", {name: /send/i}));

        await user.click(await screen.findByRole("button", {name: "Copy message"}));
        expect(await navigator.clipboard.readText()).toBe("ocean data");
    });

    it("does not carry one conversation's open citation into another", async () => {
        server.use(
            http.get("/api/search/conversations", () => HttpResponse.json([
                {thread_id: "t-9", label: "Earlier chat"},
            ])),
            http.get("/api/search/conversation/t-9", () => HttpResponse.json({
                thread_id: "t-9",
                label: "Earlier chat",
                items: [
                    {type: "message", role: "user", content: "earlier question"},
                    {type: "tool_call", id: "c9", name: "search_data", arguments: {}},
                    {type: "tool_result", call_id: "c9", content: JSON.stringify({hits: [hit]})},
                    {type: "message", role: "assistant", content: `See [Ocean temps](${DATASET_URL}).`},
                ],
            })),
        );
        const user = userEvent.setup();
        renderChat();

        await user.type(await screen.findByRole("textbox"), "ocean data");
        await user.click(screen.getByRole("button", {name: /send/i}));

        // Open the reference from this answer's citation.
        await user.click(await screen.findByRole("link", {name: /Ocean temps/}));
        expect(await screen.findByRole("button", {name: /Hide details of Ocean Temperatures 2023/}))
            .toBeInTheDocument();

        // The other conversation cites the same dataset, and starts with it closed.
        await user.click(await screen.findByText("Earlier chat"));
        expect(await screen.findByText("earlier question")).toBeInTheDocument();
        expect(screen.queryByRole("button", {name: /Hide details of/})).not.toBeInTheDocument();
        expect(screen.getByRole("button", {name: /Show details of Ocean Temperatures 2023/})).toBeInTheDocument();
    });

    it("opens a conversation at its most recent message", async () => {
        // jsdom lays nothing out, so the container has to be told it overflows.
        Object.defineProperty(HTMLElement.prototype, "scrollHeight", {configurable: true, value: 900});
        try {
            server.use(
                http.get("/api/search/conversations", () => HttpResponse.json([
                    {thread_id: "t-9", label: "Earlier chat"},
                ])),
                http.get("/api/search/conversation/t-9", () => HttpResponse.json({
                    thread_id: "t-9",
                    label: "Earlier chat",
                    items: [{type: "message", role: "user", content: "earlier question"}],
                })),
            );
            const user = userEvent.setup();
            renderChat();

            await user.type(await screen.findByRole("textbox"), "ocean data");
            await user.click(screen.getByRole("button", {name: /send/i}));
            await screen.findByRole("link", {name: /Ocean temps/});

            // The messages scroll in their own container, the scrollable ancestor of
            // every bubble. Leave it part-way up the thread, as a reader would.
            const container = screen.getByText("ocean data").closest(".overflow-y-auto") as HTMLElement;
            container.scrollTop = 120;

            await user.click(await screen.findByText("Earlier chat"));
            await screen.findByText("earlier question");
            expect(container.scrollTop).toBe(900);
        } finally {
            Reflect.deleteProperty(HTMLElement.prototype, "scrollHeight");
        }
    });
});
