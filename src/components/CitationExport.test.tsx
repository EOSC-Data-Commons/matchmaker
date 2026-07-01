import {describe, it, expect, vi, beforeEach, afterEach} from "vitest";
import {render, screen, waitForElementToBeRemoved} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {http, HttpResponse} from "msw";
import {server} from "@/test/msw/server";
import {makeDataset} from "@/test/fixtures/datasets";
import {CitationExport} from "./CitationExport";

// fetchDOICitation caches per doi+format at module level, so every test uses
// a distinct DOI to stay independent.
const datasetWithDoi = (doi: string) => makeDataset({_id: `https://doi.org/${doi}`});
const datasetWithoutDoi = makeDataset({_id: "https://example.org/dataset/1"});

const openPanel = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.click(screen.getByRole("button", {name: /cite/i}));
    const dialog = await screen.findByRole("dialog", {name: "Export citation"});
    if (screen.queryByText("Loading citation...")) {
        await waitForElementToBeRemoved(() => screen.queryByText("Loading citation..."));
    }
    return dialog;
};

describe("CitationExport", () => {
    beforeEach(() => {
        URL.createObjectURL = vi.fn(() => "blob:mock");
        URL.revokeObjectURL = vi.fn();
        vi.spyOn(console, "warn").mockImplementation(() => {});
        vi.spyOn(console, "debug").mockImplementation(() => {});
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("prefers official DOI metadata when the DOI resolves", async () => {
        const user = userEvent.setup();
        server.use(http.get("https://doi.org/:doi", () => HttpResponse.text("@misc{official_citation}")));
        render(<CitationExport dataset={datasetWithDoi("10.1111/doi.ok")}/>);

        await openPanel(user);
        expect(screen.getByText("@misc{official_citation}")).toBeInTheDocument();
        expect(screen.getByText("Fetched from official DOI metadata")).toBeInTheDocument();
    });

    it("falls back to a locally generated citation when the DOI lookup fails", async () => {
        const user = userEvent.setup();
        server.use(http.get("https://doi.org/:doi", () => new HttpResponse(null, {status: 404})));
        render(<CitationExport dataset={datasetWithDoi("10.2222/doi.missing")}/>);

        await openPanel(user);
        expect(screen.getByText(/@misc\{Doe_2023_/)).toBeInTheDocument();
        expect(screen.getByText("Generated automatically; please verify before use.")).toBeInTheDocument();
    });

    it("generates locally without any network call when the dataset has no DOI", async () => {
        const user = userEvent.setup();
        render(<CitationExport dataset={datasetWithoutDoi}/>);

        await openPanel(user);
        expect(screen.getByText(/@misc\{Doe_2023_/)).toBeInTheDocument();
    });

    it("switching format regenerates the citation", async () => {
        const user = userEvent.setup();
        render(<CitationExport dataset={datasetWithoutDoi}/>);

        await openPanel(user);
        await user.selectOptions(screen.getByRole("combobox"), "ris");
        // RTL's matcher normalizes whitespace, so match the collapsed form
        expect(await screen.findByText(/TY - DATA/)).toBeInTheDocument();
    });

    it("copies the citation to the clipboard", async () => {
        // userEvent.setup() installs a working clipboard stub — read it back
        const user = userEvent.setup();
        render(<CitationExport dataset={datasetWithoutDoi}/>);

        await openPanel(user);
        await user.click(screen.getByRole("button", {name: "Copy citation"}));

        expect(await screen.findByText("Copied")).toBeInTheDocument();
        expect(await navigator.clipboard.readText()).toContain("@misc{Doe_2023_");
    });

    it("downloads the citation as a file named after the dataset", async () => {
        const user = userEvent.setup();
        const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
        let downloadName = "";
        click.mockImplementation(function (this: HTMLAnchorElement) {
            downloadName = this.download;
        });
        render(<CitationExport dataset={datasetWithoutDoi}/>);

        await openPanel(user);
        await user.click(screen.getByRole("button", {name: "Download citation file"}));

        expect(URL.createObjectURL).toHaveBeenCalledOnce();
        expect(downloadName).toBe("Test_Dataset_Title.bib");
        expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:mock");
    });
});
