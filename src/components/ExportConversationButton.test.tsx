import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {render, screen} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {MemoryRouter, Route, Routes, useLocation} from "react-router";
import type {Message} from "@/types/chat";
import type {UserInfo} from "@/types/user";
import {ExportConversationButton} from "./ExportConversationButton";

type Paq = Array<Array<string | number>>;
const paq = () => window._paq as unknown as Paq;

const messages: Message[] = [
    {sender: "user", content: "ocean data"},
    {sender: "bot", content: "Here is what I found."},
];
const jane: UserInfo = {sub: "u-1", email: "jane@example.org", name: "Jane Doe"};

// Shows where the PDF action led, and the state it carried.
const ExportTarget = () => {
    const location = useLocation();
    return <p data-testid="target">{location.pathname + location.search}|{JSON.stringify(location.state)}</p>;
};

const renderButton = (props: { user?: UserInfo | null; answering?: boolean } = {}) => render(
    <MemoryRouter initialEntries={["/chat/t-1"]}>
        <Routes>
            <Route path="/chat/:id" element={
                                         <ExportConversationButton
                                            conversationId="t-1"
                                            title="Ocean data"
                                            messages={messages}
                                            user={props.user === undefined ? jane : props.user}
                                            answering={props.answering ?? false}
                                        />
                                    }/>
            <Route path="/chat/:id/export" element={<ExportTarget/>}/>
        </Routes>
    </MemoryRouter>,
);

const open = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.click(screen.getByRole("button", {name: "Export conversation"}));
    return screen.findByRole("dialog", {name: "Export conversation"});
};

// The Markdown that a click on "Markdown file (.md)" saved.
const captureDownloads = () => {
    const saved: { name: string; text: Promise<string> }[] = [];
    let blob: Blob | null = null;
    vi.spyOn(URL, "createObjectURL").mockImplementation(value => {
        blob = value as Blob;
        return "blob:export";
    });
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {
    });
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
        saved.push({name: this.download, text: blob!.text()});
    });
    return saved;
};

describe("ExportConversationButton", () => {
    beforeEach(() => {
        window._paq = [];
    });

    afterEach(() => {
        vi.restoreAllMocks();
        delete (window as Partial<Window>)._paq;
    });

    it("saves the conversation as Markdown without the exporter's name", async () => {
        const user = userEvent.setup();
        const saved = captureDownloads();
        renderButton();

        await open(user);
        expect(screen.getByRole("checkbox", {name: "Add my name"})).not.toBeChecked();
        await user.click(screen.getByRole("button", {name: "Markdown file (.md)"}));

        expect(saved).toHaveLength(1);
        expect(saved[0].name).toMatch(/^eosc-data-commons-conversation-ocean-data-\d{4}-\d{2}-\d{2}\.md$/);
        const markdown = await saved[0].text;
        expect(markdown).toContain("# Ocean data");
        expect(markdown).toContain("## Question\n\nocean data");
        expect(markdown).not.toContain("Jane");
        expect(paq()).toContainEqual(["trackEvent", "Chat", "conversation_exported", "markdown"]);
        // The panel closes once the file is saved.
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    it("adds the display name, never the email address, when asked to", async () => {
        const user = userEvent.setup();
        const saved = captureDownloads();
        renderButton();

        await open(user);
        await user.click(screen.getByRole("checkbox", {name: "Add my name"}));
        await user.click(screen.getByRole("button", {name: "Markdown file (.md)"}));

        const markdown = await saved[0].text;
        expect(markdown).toContain("Exported by Jane Doe.");
        expect(markdown).not.toContain("jane@example.org");
    });

    it("starts with the name left out every time it opens", async () => {
        const user = userEvent.setup();
        renderButton();

        await open(user);
        await user.click(screen.getByRole("checkbox", {name: "Add my name"}));
        await user.keyboard("{Escape}");
        await open(user);

        expect(screen.getByRole("checkbox", {name: "Add my name"})).not.toBeChecked();
    });

    it("offers no name without a signed-in user", async () => {
        const user = userEvent.setup();
        renderButton({user: null});

        await open(user);

        expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
        expect(screen.getByRole("button", {name: "PDF"})).toBeInTheDocument();
    });

    it("opens the printable view, passing only whether to add the name", async () => {
        const user = userEvent.setup();
        renderButton();

        await open(user);
        await user.click(screen.getByRole("checkbox", {name: "Add my name"}));
        await user.click(screen.getByRole("button", {name: "PDF"}));

        const target = screen.getByTestId("target").textContent!;
        expect(target).toBe('/chat/t-1/export?byline=1|{"title":"Ocean data"}');
        expect(target).not.toContain("Jane");
        expect(paq()).toContainEqual(["trackEvent", "Chat", "conversation_exported", "pdf"]);
    });

    it("opens the printable view without a byline by default", async () => {
        const user = userEvent.setup();
        renderButton();

        await open(user);
        await user.click(screen.getByRole("button", {name: "PDF"}));

        expect(screen.getByTestId("target").textContent).toBe('/chat/t-1/export|{"title":"Ocean data"}');
    });

    it("says why there is nothing to export while an answer is being written", async () => {
        const user = userEvent.setup();
        renderButton({answering: true});

        await open(user);

        expect(screen.getByText("Available once the answer is finished.")).toBeInTheDocument();
        expect(screen.queryByRole("button", {name: "Markdown file (.md)"})).not.toBeInTheDocument();
        expect(screen.queryByRole("button", {name: "PDF"})).not.toBeInTheDocument();
    });
});
