import {describe, it, expect, vi} from "vitest";
import {render, screen} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {CopyMessageButton} from "./CopyMessageButton";

describe("CopyMessageButton", () => {
    it("puts the message on the clipboard and confirms it", async () => {
        // userEvent.setup() installs a working clipboard stub — read it back.
        const user = userEvent.setup();
        render(<CopyMessageButton text="datasets about ocean temperature"/>);

        await user.click(screen.getByRole("button", {name: "Copy message"}));

        expect(await navigator.clipboard.readText()).toBe("datasets about ocean temperature");
        expect(await screen.findByRole("button", {name: "Message copied"})).toBeInTheDocument();
    });

    it("claims nothing when the clipboard refuses", async () => {
        const user = userEvent.setup();
        const warn = vi.spyOn(console, "warn").mockImplementation(() => {
        });
        vi.spyOn(navigator.clipboard, "writeText").mockRejectedValue(new Error("denied"));
        render(<CopyMessageButton text="ocean data"/>);

        await user.click(screen.getByRole("button", {name: "Copy message"}));

        expect(screen.getByRole("button", {name: "Copy message"})).toBeInTheDocument();
        expect(screen.queryByRole("button", {name: "Message copied"})).not.toBeInTheDocument();
        expect(warn).toHaveBeenCalled();
    });
});
