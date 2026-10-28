import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {render, screen, waitFor} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {MemoryRouter, Route, Routes} from "react-router";
import {http, HttpResponse} from "msw";
import {server} from "@/test/msw/server";
import {makeDataset} from "@/test/fixtures/datasets";
import {sse, sseResponse} from "@/test/sse";
import {discardRun, getChatRuns, startRun} from "@/lib/chatRuns";
import ChatExportPage from "./ChatExportPage";

const DATASET_URL = "https://doi.org/10.5281/zenodo.1234567";
const hit = makeDataset({dataset_url: DATASET_URL, title: "Ocean Temperatures 2023"});

// A stored conversation as GET /conversation/{id} returns it.
const stored = {
    thread_id: "t-1",
    label: "Ocean data",
    items: [
        {type: "message", role: "user", content: "ocean data"},
        {type: "tool_call", id: "c1", name: "search_data", arguments: {query: "ocean"}},
        {type: "tool_result", call_id: "c1", content: JSON.stringify({total_found: 1, hits: [hit]})},
        {type: "message", role: "assistant", content: `See [Ocean temps](${DATASET_URL}).`},
    ],
};

let print: ReturnType<typeof vi.fn>;

beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {
    });
    // happy-dom has no print dialog to spy on.
    print = vi.fn();
    window.print = print as unknown as typeof window.print;
    server.use(
        http.get("/auth/user", () => HttpResponse.json({sub: "u-1", name: "Jane Doe", email: "jane@example.org"})),
        http.get("/api/search/conversation/:id", () => HttpResponse.json(stored)),
    );
});

afterEach(() => {
    vi.restoreAllMocks();
    delete (window as Partial<Window>).print;
    getChatRuns().forEach(run => discardRun(run.key));
});

const renderExport = (path = "/chat/t-1/export", state?: unknown) => render(
    <MemoryRouter initialEntries={[{
        pathname: path.split("?")[0],
        search: path.includes("?") ? `?${path.split("?")[1]}` : "",
        state
    }]}>
        <Routes>
            <Route path="/chat/:id/export" element={<ChatExportPage/>}/>
            <Route path="/chat/:id?" element={<p>conversation page</p>}/>
        </Routes>
    </MemoryRouter>,
);

describe("ChatExportPage", () => {
    it("renders a stored conversation and opens the print dialog once", async () => {
        renderExport();

        expect(await screen.findByRole("heading", {level: 1, name: "Ocean data"})).toBeInTheDocument();
        expect(screen.getByText("ocean data")).toBeInTheDocument();
        expect(screen.getByRole("link", {name: /\[1].*Ocean temps/})).toHaveAttribute("href", DATASET_URL);
        await waitFor(() => expect(print).toHaveBeenCalledTimes(1));
        // Without ?byline=1 the document carries no name.
        expect(screen.queryByText(/Exported by/)).not.toBeInTheDocument();
    });

    it("titles the page after the conversation only while printing", async () => {
        const titleBefore = document.title;
        let titleWhilePrinting = "";
        print.mockImplementation(() => {
            titleWhilePrinting = document.title;
        });
        renderExport();

        await waitFor(() => expect(print).toHaveBeenCalled());
        expect(titleWhilePrinting).toBe("Ocean data, EOSC Data Commons");
        window.dispatchEvent(new Event("afterprint"));
        expect(document.title).toBe(titleBefore);
    });

    it("prefers the title the conversation page showed", async () => {
        renderExport("/chat/t-1/export", {title: "My ocean question"});
        expect(await screen.findByRole("heading", {level: 1, name: "My ocean question"})).toBeInTheDocument();
    });

    it("adds the display name when the byline was asked for", async () => {
        renderExport("/chat/t-1/export?byline=1");
        expect(await screen.findByText("Exported by Jane Doe")).toBeInTheDocument();
        expect(screen.queryByText(/jane@example.org/)).not.toBeInTheDocument();
    });

    it("uses this visit's run, which holds a turn the backend has not stored yet", async () => {
        let fetched = false;
        server.use(
            http.get("/api/search/conversation/:id", () => {
                fetched = true;
                return HttpResponse.json(stored);
            }),
            http.post("/api/search/chat", () => sseResponse(sse([
                {type: "RUN_STARTED", thread_id: "t-9"},
                {type: "TEXT_MESSAGE_START", message_id: "m1"},
                {type: "TEXT_MESSAGE_CHUNK", delta: "A fresh answer."},
                {type: "TEXT_MESSAGE_END", message_id: "m1"},
                {type: "RUN_FINISHED", thread_id: "t-9"},
            ]))),
        );
        await startRun({
            key: "new-1",
            title: "Fresh question",
            messages: [{sender: "user", content: "Fresh question"}],
            model: "test",
        });

        renderExport("/chat/t-9/export");

        expect(await screen.findByText("A fresh answer.")).toBeInTheDocument();
        expect(screen.getByRole("heading", {level: 1, name: "Fresh question"})).toBeInTheDocument();
        expect(fetched).toBe(false);
    });

    it("says when the conversation cannot be loaded, and does not print", async () => {
        server.use(http.get("/api/search/conversation/:id", () => new HttpResponse(null, {status: 404})));
        renderExport();

        expect(await screen.findByText(/could not be loaded/)).toBeInTheDocument();
        expect(print).not.toHaveBeenCalled();
    });

    it("asks a signed-out visitor to sign in", async () => {
        server.use(http.get("/auth/user", () => new HttpResponse(null, {status: 401})));
        renderExport();

        expect(await screen.findByRole("heading", {name: "Sign in to export this conversation"})).toBeInTheDocument();
        expect(screen.getByRole("button", {name: "Save as PDF"})).toBeDisabled();
        expect(print).not.toHaveBeenCalled();
    });

    it("offers the Markdown file and a way back from the toolbar", async () => {
        const user = userEvent.setup();
        vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:export");
        vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {
        });
        const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {
        });
        renderExport();

        await screen.findByRole("heading", {level: 1, name: "Ocean data"});
        await user.click(screen.getByRole("button", {name: "Download Markdown"}));
        expect(click).toHaveBeenCalledTimes(1);

        await user.click(screen.getByRole("button", {name: "Back to conversation"}));
        expect(screen.getByText("conversation page")).toBeInTheDocument();
    });
});
