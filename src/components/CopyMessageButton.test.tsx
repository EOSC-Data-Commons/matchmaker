import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {render, screen} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {CopyMessageButton} from "./CopyMessageButton";

describe("CopyMessageButton", () => {
    beforeEach(() => {
        window._paq = [];
    });

    afterEach(() => {
        vi.restoreAllMocks();
        delete (window as Partial<Window>)._paq;
    });

    it("puts the message on the clipboard and confirms it", async () => {
        // userEvent.setup() installs a working clipboard stub — read it back.
        const user = userEvent.setup();
        render(<CopyMessageButton text="datasets about ocean temperature" sender="user"/>);

        await user.click(screen.getByRole("button", {name: "Copy message"}));

        expect(await navigator.clipboard.readText()).toBe("datasets about ocean temperature");
        expect(await screen.findByRole("button", {name: "Message copied"})).toBeInTheDocument();
    });

    it("counts the copy by whose message it was", async () => {
        const user = userEvent.setup();
        render(<CopyMessageButton text="Here is what I found." sender="assistant"/>);

        await user.click(screen.getByRole("button", {name: "Copy message"}));
        await screen.findByRole("button", {name: "Message copied"});

        expect(window._paq).toEqual([["trackEvent", "AI Mode", "message_copied", "assistant"]]);
    });

    it("claims nothing when the clipboard refuses", async () => {
        const user = userEvent.setup();
        const warn = vi.spyOn(console, "warn").mockImplementation(() => {
        });
        vi.spyOn(navigator.clipboard, "writeText").mockRejectedValue(new Error("denied"));
        render(<CopyMessageButton text="ocean data" sender="user"/>);

        await user.click(screen.getByRole("button", {name: "Copy message"}));

        expect(screen.getByRole("button", {name: "Copy message"})).toBeInTheDocument();
        expect(screen.queryByRole("button", {name: "Message copied"})).not.toBeInTheDocument();
        expect(warn).toHaveBeenCalled();
        // Nothing was copied, so nothing is counted.
        expect(window._paq).toEqual([]);
    });
});
