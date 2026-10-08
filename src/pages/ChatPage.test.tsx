import {describe, it, expect, vi, beforeEach, afterEach} from "vitest";
import {render, screen, waitFor, within} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {MemoryRouter, Route, Routes} from "react-router";
import {http, HttpResponse} from "msw";
import {server} from "@/test/msw/server";
import {makeDataset} from "@/test/fixtures/datasets";
import {sse, sseResponse} from "@/test/sse";
import {discardRun, getChatRuns} from "@/lib/chatRuns";
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

// Runs live in module state, outside any one render of the page.
afterEach(() => {
    getChatRuns().forEach(run => discardRun(run.key));
});

/**
 * A chat response that sends `first`, then holds the stream open until `finish()`
 * sends `rest`, so a test can act while the answer is still being written.
 */
const heldRun = (first: object[], rest: object[]) => {
    const encoder = new TextEncoder();
    let finish!: () => void;
    const released = new Promise<void>(resolve => {
        finish = resolve;
    });
    const response = () => new HttpResponse(
        new ReadableStream<Uint8Array>({
            async start(controller) {
                controller.enqueue(encoder.encode(sse(first)));
                await released;
                try {
                    controller.enqueue(encoder.encode(sse(rest)));
                    controller.close();
                } catch {
                    // Nobody is reading any more: the run was stopped.
                }
            },
        }),
        {headers: {"Content-Type": "text/event-stream"}},
    );
    return {response, finish};
};

const firstHalf = [
    {type: "RUN_STARTED", thread_id: "t-5"},
    {type: "TEXT_MESSAGE_START", message_id: "m1"},
    {type: "TEXT_MESSAGE_CHUNK", delta: "First half,"},
];
const secondHalf = [
    {type: "TEXT_MESSAGE_CHUNK", delta: " second half."},
    {type: "TEXT_MESSAGE_END", message_id: "m1"},
    {type: "RUN_FINISHED", thread_id: "t-5"},
];

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

        // The question comes before its answer, so its button is the first.
        const [question] = await screen.findAllByRole("button", {name: "Copy message"});
        await user.click(question);
        expect(await navigator.clipboard.readText()).toBe("ocean data");
    });

    it("copies an answer once it has finished streaming", async () => {
        const run = heldRun(firstHalf, secondHalf);
        server.use(http.post("/api/search/chat", run.response));
        const user = userEvent.setup();
        renderChat();

        await user.type(await screen.findByRole("textbox"), "ocean data");
        await user.click(screen.getByRole("button", {name: /send/i}));
        expect(await screen.findByText("First half,")).toBeInTheDocument();

        // Only the question can be copied while the answer is still being written.
        expect(screen.getAllByRole("button", {name: "Copy message"})).toHaveLength(1);

        run.finish();
        await waitFor(() => expect(screen.getAllByRole("button", {name: "Copy message"})).toHaveLength(2));
        await user.click(screen.getAllByRole("button", {name: "Copy message"})[1]);
        expect(await navigator.clipboard.readText()).toBe("First half, second half.");
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
            const container = screen.getByText("ocean data", {selector: "p"}).closest(".overflow-y-auto") as HTMLElement;
            container.scrollTop = 120;

            await user.click(await screen.findByText("Earlier chat"));
            await screen.findByText("earlier question");
            expect(container.scrollTop).toBe(900);
        } finally {
            Reflect.deleteProperty(HTMLElement.prototype, "scrollHeight");
        }
    });

    it("keeps an answer going after New Chat, and shows it when its conversation is opened again", async () => {
        const run = heldRun(firstHalf, secondHalf);
        server.use(http.post("/api/search/chat", run.response));
        const user = userEvent.setup();
        renderChat();

        await user.type(await screen.findByRole("textbox"), "ocean data");
        await user.click(screen.getByRole("button", {name: /send/i}));
        expect(await screen.findByText("First half,")).toBeInTheDocument();

        await user.click(screen.getByRole("button", {name: /new chat/i}));

        // The new chat can be used straight away, and the answer does not follow into it.
        expect(screen.getByRole("button", {name: /send/i})).toBeEnabled();
        expect(screen.queryByText(/First half/)).not.toBeInTheDocument();
        // The sidebar lists the conversation before the backend does, as still being answered.
        expect(screen.getByText("Answer in progress:")).toBeInTheDocument();

        run.finish();
        expect(await screen.findByText("New answer:")).toBeInTheDocument();
        expect(screen.queryByText(/second half/)).not.toBeInTheDocument();

        // Opened again, it shows the whole answer from the run: there is no handler for
        // GET /conversation/t-5, so a fetch would fail the test.
        await user.click(screen.getByText("ocean data"));
        expect(await screen.findByText("First half, second half.")).toBeInTheDocument();
        expect(screen.getByText("ocean data", {selector: "p"})).toBeInTheDocument();
        expect(screen.queryByText("New answer:")).not.toBeInTheDocument();
    });

    it("does not write a running answer into another conversation", async () => {
        const run = heldRun(firstHalf, secondHalf);
        server.use(
            http.post("/api/search/chat", run.response),
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
        expect(await screen.findByText("First half,")).toBeInTheDocument();

        await user.click(screen.getByText("Earlier chat"));
        expect(await screen.findByText("earlier question")).toBeInTheDocument();

        run.finish();
        expect(await screen.findByText("New answer:")).toBeInTheDocument();
        expect(screen.getByText("earlier question")).toBeInTheDocument();
        expect(screen.queryByText(/First half/)).not.toBeInTheDocument();
        expect(screen.queryByText("ocean data", {selector: "p"})).not.toBeInTheDocument();
    });

    it("stops an answer with the Stop button and keeps what it had written", async () => {
        const run = heldRun(firstHalf, secondHalf);
        server.use(http.post("/api/search/chat", run.response));
        const user = userEvent.setup();
        renderChat();

        const input = await screen.findByRole("textbox");
        await user.type(input, "ocean data");
        await user.click(screen.getByRole("button", {name: /send/i}));
        expect(await screen.findByText("First half,")).toBeInTheDocument();

        // Text typed while the answer runs is not sent by stopping it.
        await user.type(input, "next question");
        await user.click(screen.getByRole("button", {name: /stop/i}));

        expect(await screen.findByRole("button", {name: /send/i})).toBeEnabled();
        expect(input).toHaveValue("next question");
        run.finish();
        await waitFor(() => expect(screen.getByText("First half,")).toBeInTheDocument());
        expect(screen.queryByText(/second half/)).not.toBeInTheDocument();
        expect(screen.getAllByText("ocean data", {selector: "p"})).toHaveLength(1);
    });
});
