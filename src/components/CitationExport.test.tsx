import {describe, it, expect, vi, beforeEach, afterEach} from "vitest";
import {render, screen, waitFor, waitForElementToBeRemoved} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {http, HttpResponse} from "msw";
import {server} from "@/test/msw/server";
import {makeDataset} from "@/test/fixtures/datasets";
import {CitationExport} from "./CitationExport";

// DOI lookups are cached per doi+format at module level, so every test uses
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

    it("opens on an APA citation from DOI metadata, as plain text", async () => {
        const user = userEvent.setup();
        let accept: string | null = null;
        server.use(http.get("https://doi.org/:doi", ({request}) => {
            accept = request.headers.get("accept");
            return HttpResponse.text("Doe, J., &amp; Smith, J. (2023). <i>Ocean data</i> [Dataset]. Zenodo.");
        }));
        render(<CitationExport dataset={datasetWithDoi("10.1111/doi.apa")}/>);

        await openPanel(user);
        expect(screen.getByRole("combobox")).toHaveValue("apa");
        expect(accept).toBe("text/x-bibliography; style=apa; locale=en-US");
        expect(screen.getByText("Doe, J., & Smith, J. (2023). Ocean data [Dataset]. Zenodo.")).toBeInTheDocument();
        expect(screen.getByText("Fetched from official DOI metadata")).toBeInTheDocument();
        // Formatted text is copied, not imported, so there is no file to download.
        expect(screen.queryByRole("button", {name: "Download citation file"})).not.toBeInTheDocument();
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
        expect(screen.getByText(
            "Doe, J., & Smith, J. (2023). Test Dataset Title [Data set]. https://doi.org/10.2222/doi.missing"
        )).toBeInTheDocument();
        expect(screen.getByText("Generated automatically; please verify before use.")).toBeInTheDocument();
    });

    it("generates locally without any network call when the dataset has no DOI", async () => {
        const user = userEvent.setup();
        render(<CitationExport dataset={datasetWithoutDoi}/>);

        await openPanel(user);
        expect(screen.getByText(/^Doe, J\., & Smith, J\. \(2023\)\. Test Dataset Title \[Data set\]\. https:\/\/example\.org\/dataset\/1$/))
            .toBeInTheDocument();
    });

    it("switching format regenerates the citation", async () => {
        const user = userEvent.setup();
        render(<CitationExport dataset={datasetWithoutDoi}/>);

        await openPanel(user);
        await user.selectOptions(screen.getByRole("combobox"), "ris");
        // RTL's matcher normalizes whitespace, so match the collapsed form
        expect(await screen.findByText(/TY - DATA/)).toBeInTheDocument();
    });

    it("renders the panel outside a container that clips its overflow", async () => {
        // The chat's cited-datasets list and a tool call's results both clip overflow.
        const user = userEvent.setup();
        render(<div data-testid="clipping-list" className="overflow-hidden"><CitationExport
            dataset={datasetWithoutDoi}/></div>);

        const dialog = await openPanel(user);
        expect(screen.getByTestId("clipping-list")).not.toContainElement(dialog);
    });

    it("closes on Escape and hands focus back to the Cite button", async () => {
        const user = userEvent.setup();
        render(<CitationExport dataset={datasetWithoutDoi}/>);

        await openPanel(user);
        await user.keyboard("{Escape}");

        await waitFor(() => expect(screen.queryByRole("dialog", {name: "Export citation"})).not.toBeInTheDocument());
        expect(screen.getByRole("button", {name: /cite/i})).toHaveFocus();
    });

    it("keeps the chosen format when an earlier lookup finishes late", async () => {
        const user = userEvent.setup();
        let releaseApa!: () => void;
        const apaHeld = new Promise<void>(resolve => {
            releaseApa = resolve;
        });
        let apaServed = false;
        server.use(http.get("https://doi.org/:doi", async ({request}) => {
            if (request.headers.get("accept")?.startsWith("text/x-bibliography")) {
                await apaHeld;
                apaServed = true;
                return HttpResponse.text("Late APA citation");
            }
            return HttpResponse.text("TY  - DATA\nER  - ");
        }));
        render(<CitationExport dataset={datasetWithDoi("10.3333/doi.race")}/>);

        await user.click(screen.getByRole("button", {name: /cite/i}));
        await user.selectOptions(screen.getByRole("combobox"), "ris");
        expect(await screen.findByText(/TY - DATA/)).toBeInTheDocument();

        releaseApa();
        await waitFor(() => expect(apaServed).toBe(true));
        await new Promise(resolve => setTimeout(resolve, 50));
        expect(screen.queryByText("Late APA citation")).not.toBeInTheDocument();
        expect(screen.getByText(/TY - DATA/)).toBeInTheDocument();
    });

    it("copies the citation to the clipboard", async () => {
        // userEvent.setup() installs a working clipboard stub — read it back
        const user = userEvent.setup();
        render(<CitationExport dataset={datasetWithoutDoi}/>);

        await openPanel(user);
        await user.click(screen.getByRole("button", {name: "Copy citation"}));

        expect(await screen.findByText("Copied")).toBeInTheDocument();
        expect(await navigator.clipboard.readText()).toBe(
            "Doe, J., & Smith, J. (2023). Test Dataset Title [Data set]. https://example.org/dataset/1"
        );
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
        await user.selectOptions(screen.getByRole("combobox"), "bibtex");
        await user.click(await screen.findByRole("button", {name: "Download citation file"}));

        expect(URL.createObjectURL).toHaveBeenCalledOnce();
        expect(downloadName).toBe("Test_Dataset_Title.bib");
        expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:mock");
    });
});
