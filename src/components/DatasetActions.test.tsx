import {describe, it, expect, vi, beforeEach, afterEach} from "vitest";
import {render, screen} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {MemoryRouter} from "react-router";
import {makeDataset} from "@/test/fixtures/datasets";
import type {BackendDataset} from "@/types/commons";
import type {DatasetContext} from "@/lib/analytics";
import {loginWithReturn} from "@/lib/authRedirect";
import {DatasetActions} from "./SearchResultItem";

// loginWithReturn does a full-page navigation, which the test DOM cannot perform.
vi.mock("@/lib/authRedirect", () => ({
    loginWithReturn: vi.fn(),
}));

// The Play button reads the search params.
const renderActions = (hit: BackendDataset, props: {isLoggedIn?: boolean; context?: DatasetContext; position?: number} = {}) =>
    render(<MemoryRouter><DatasetActions hit={hit} context="search" {...props}/></MemoryRouter>);

type Paq = Array<Array<string | number | boolean>>;
const events = () => (window._paq as unknown as Paq).filter(c => c[0] === "trackEvent");

describe("DatasetActions", () => {
    beforeEach(() => {
        window._paq = [];
        vi.mocked(loginWithReturn).mockClear();
        vi.spyOn(window, "open").mockImplementation(() => null);
    });

    afterEach(() => {
        vi.restoreAllMocks();
        delete (window as Partial<Window>)._paq;
    });

    it("links Source to the dataset id", () => {
        const hit = makeDataset({_id: "https://doi.org/10.5281/zenodo.1", title: "Ocean Temperatures 2023"});
        renderActions(hit);
        expect(screen.getByRole("link", {name: /source of dataset Ocean Temperatures 2023/}))
            .toHaveAttribute("href", "https://doi.org/10.5281/zenodo.1");
    });

    it("drops Source when the id is not an http(s) URL, keeping the other actions", () => {
        const {container} = renderActions(makeDataset({_id: "javascript:alert(1)"}));
        expect(screen.queryByRole("link", {name: /source of dataset/})).not.toBeInTheDocument();
        expect(container.innerHTML).not.toContain("javascript:");
        expect(screen.getByRole("button", {name: /data player/})).toBeInTheDocument();
    });

    it("drops Source when the id is a bare identifier", () => {
        renderActions(makeDataset({_id: "ds-1"}));
        expect(screen.queryByRole("link", {name: /source of dataset/})).not.toBeInTheDocument();
    });

    describe("Play", () => {
        const openedParams = () => {
            const url = vi.mocked(window.open).mock.calls[0][0] as string;
            return new URL(url, "http://localhost").searchParams;
        };

        it("passes the filedb record identifier and its endpoint to the data player", async () => {
            const user = userEvent.setup();
            renderActions(makeDataset({
                _id: "https://urn.nsk.hr/urn:nbn:hr:217:280657",
                _source: {_repo: "DABAR", _harvest_url: "https://dabar.srce.hr/oai/", _record_identifier: "pmf_15188"},
            }), {isLoggedIn: true});

            await user.click(screen.getByRole("button", {name: /View dataset/}));
            const params = openedParams();
            expect(params.get("datasetId")).toBe("https://urn.nsk.hr/urn:nbn:hr:217:280657");
            expect(params.get("recordId")).toBe("pmf_15188");
            expect(params.get("harvestUrl")).toBe("https://dabar.srce.hr/oai/");
        });

        it("sends neither when the record predates the record identifier", async () => {
            const user = userEvent.setup();
            renderActions(makeDataset({
                _source: {
                    _harvest_url: "https://dabar.srce.hr/oai/",
                    _record_identifier: null
                }
            }), {isLoggedIn: true});

            await user.click(screen.getByRole("button", {name: /View dataset/}));
            const params = openedParams();
            expect(params.has("recordId")).toBe(false);
            expect(params.has("harvestUrl")).toBe(false);
        });
    });

    describe("analytics", () => {
        const hit = makeDataset({_source: {_repo: "DANS"}});

        it("sends an anonymous Play click to login, reporting nothing itself", async () => {
            const user = userEvent.setup();
            renderActions(hit, {isLoggedIn: false});

            await user.click(screen.getByRole("button", {name: /data player/}));
            expect(loginWithReturn).toHaveBeenCalledExactlyOnceWith("play_button");
            expect(window.open).not.toHaveBeenCalled();
            expect(events()).toEqual([]);
        });

        it("reports Play by context, repository and position, then opens the data player", async () => {
            const user = userEvent.setup();
            renderActions(hit, {isLoggedIn: true, context: "ai_results", position: 3});

            await user.click(screen.getByRole("button", {name: /View dataset/}));
            expect(events()).toEqual([["trackEvent", "Dataset", "play_clicked", "ai_results:dans", 3]]);
            expect(window.open).toHaveBeenCalledWith(expect.stringMatching(/^\/dataplayer\?/), "_blank", "noopener,noreferrer");
            expect(JSON.stringify(window._paq)).not.toContain("Test Dataset Title");
        });

        it("omits the value when the position is unknown, and falls back to an unknown repository", async () => {
            const user = userEvent.setup();
            renderActions(makeDataset(), {isLoggedIn: true});

            await user.click(screen.getByRole("button", {name: /View dataset/}));
            expect(events()).toEqual([["trackEvent", "Dataset", "play_clicked", "search:unknown"]]);
        });

        it("reports the Source link the same way", async () => {
            const user = userEvent.setup();
            renderActions(hit, {position: 1});

            await user.click(screen.getByRole("link", {name: /source of dataset/}));
            expect(events()).toEqual([["trackEvent", "Dataset", "source_opened", "search:dans", 1]]);
        });
    });
});
