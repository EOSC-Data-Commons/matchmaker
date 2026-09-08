import {describe, it, expect} from "vitest";
import {render, screen} from "@testing-library/react";
import {MemoryRouter} from "react-router";
import {makeDataset} from "@/test/fixtures/datasets";
import type {BackendDataset} from "@/types/commons";
import {DatasetActions} from "./SearchResultItem";

// The Play button reads the search params.
const renderActions = (hit: BackendDataset) =>
    render(<MemoryRouter><DatasetActions hit={hit}/></MemoryRouter>);

describe("DatasetActions", () => {
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
});
