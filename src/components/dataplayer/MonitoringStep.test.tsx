import {describe, it, expect, vi, beforeEach, afterEach} from "vitest";
import {render, screen} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {MonitoringStep} from "./MonitoringStep";
import type {ToolConfig} from "@/types/dataplayerTypes";

type Paq = Array<Array<string | number | boolean>>;
const paq = () => window._paq as unknown as Paq;

beforeEach(() => {
    window._paq = [];
    vi.spyOn(window, "open").mockImplementation(() => null);
});
afterEach(() => {
    vi.restoreAllMocks();
    delete (window as Partial<Window>)._paq;
});

describe("MonitoringStep analytics", () => {
    it("names the opened tool together with the dataset it was launched on", async () => {
        render(
            <MonitoringStep
                statusType="READY"
                statusMessage="Done"
                datasetTitle="A dataset"
                datasetRef="10.5281/zenodo.123"
                selectedToolId="tool-1"
                toolConfig={{name: "Jupyter"} as ToolConfig}
                taskId="task-1"
                taskResult={{url: "https://vre.example/run/1"}}
                onStartOver={() => {}}
            />,
        );

        await userEvent.click(screen.getByRole("button", {name: /open the tool/i}));

        expect(paq().filter(c => c[0] === "trackEvent")).toEqual([
            ["trackEvent", "Data Player", "tool_opened", "Jupyter:10.5281/zenodo.123"],
        ]);
        expect(paq()).toContainEqual(["trackLink", "https://vre.example/run/1", "link"]);
        expect(window.open).toHaveBeenCalledWith("https://vre.example/run/1", "_blank", "noopener,noreferrer");
    });
});
