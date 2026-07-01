import {describe, it, expect, vi} from "vitest";
import {render, screen, fireEvent} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {ModelSelector} from "./ModelSelector";

const models = ["openai/gpt-4.1", "mistralai/mistral-large-latest", "cesnet/agentic"];

describe("ModelSelector", () => {
    it("shows a friendly short name for the selected model", () => {
        render(<ModelSelector models={models} selectedModel="openai/gpt-4.1" onModelChange={() => {}}/>);
        expect(screen.getByRole("button")).toHaveTextContent("GPT-4.1");
    });

    it("falls back to the raw model name when unrecognised", () => {
        render(<ModelSelector models={models} selectedModel="cesnet/agentic" onModelChange={() => {}}/>);
        expect(screen.getByRole("button")).toHaveTextContent("agentic");
    });

    it("propagates a selection and closes the list", async () => {
        const user = userEvent.setup();
        const onModelChange = vi.fn();
        render(<ModelSelector models={models} selectedModel="cesnet/agentic" onModelChange={onModelChange}/>);

        await user.click(screen.getByRole("button"));
        await user.click(screen.getByText("Mistral"));

        expect(onModelChange).toHaveBeenCalledWith("mistralai/mistral-large-latest");
        expect(screen.queryByRole("list")).not.toBeInTheDocument();
    });

    it("closes when clicking outside", async () => {
        const user = userEvent.setup();
        render(<ModelSelector models={models} selectedModel="cesnet/agentic" onModelChange={() => {}}/>);

        await user.click(screen.getByRole("button"));
        expect(screen.getByRole("list")).toBeInTheDocument();

        fireEvent.mouseDown(document.body);
        expect(screen.queryByRole("list")).not.toBeInTheDocument();
    });
});
