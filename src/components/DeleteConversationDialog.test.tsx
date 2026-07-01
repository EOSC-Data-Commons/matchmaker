import {describe, it, expect, vi} from "vitest";
import {render, screen} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {DeleteConversationDialog} from "./DeleteConversationDialog";

describe("DeleteConversationDialog", () => {
    it("renders nothing while closed", () => {
        const {container} = render(
            <DeleteConversationDialog isOpen={false} onClose={() => {}} onConfirm={() => {}}/>,
        );
        expect(container).toBeEmptyDOMElement();
    });

    it("requires an explicit Delete click to confirm", async () => {
        const user = userEvent.setup();
        const onConfirm = vi.fn();
        const onClose = vi.fn();
        render(<DeleteConversationDialog isOpen onClose={onClose} onConfirm={onConfirm}/>);

        expect(screen.getByText("Delete Chat?")).toBeInTheDocument();
        await user.click(screen.getByRole("button", {name: "Delete"}));
        expect(onConfirm).toHaveBeenCalledOnce();
        expect(onClose).not.toHaveBeenCalled();
    });

    it("cancel closes without confirming", async () => {
        const user = userEvent.setup();
        const onConfirm = vi.fn();
        const onClose = vi.fn();
        render(<DeleteConversationDialog isOpen onClose={onClose} onConfirm={onConfirm}/>);

        await user.click(screen.getByRole("button", {name: "Cancel"}));
        expect(onClose).toHaveBeenCalledOnce();
        expect(onConfirm).not.toHaveBeenCalled();
    });
});
