import {describe, it, expect, vi} from "vitest";
import {render, screen, within} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {MemoryRouter} from "react-router";
import {makeDataset} from "@/test/fixtures/datasets";
import type {DatasetCitation} from "@/lib/datasetCitations";
import {CitedDatasets} from "./CitedDatasets";

const first = makeDataset({
    title: "Ocean Temperatures 2023",
    dataset_url: "https://doi.org/10.5281/zenodo.1", _id: "https://doi.org/10.5281/zenodo.1",
    _source: {_repo: "Zenodo"},
});
const second = makeDataset({
    title: "Soil Moisture 2021",
    dataset_url: "https://doi.org/10.5281/zenodo.2", _id: "https://doi.org/10.5281/zenodo.2",
    publication_date: "2021-03-02",
    description: "x".repeat(400),
    _source: {_repo: "Zenodo", creators: [{creatorName: "Ada"}, {creatorName: "Bo"}, {creatorName: "Cy"}]},
});
const third = makeDataset({
    title: "Reactor Steel SEM",
    dataset_url: "https://doi.org/10.14278/rodare.1", _id: "https://doi.org/10.14278/rodare.1",
    _source: {_repo: "PANOSC"},
});
const citations: DatasetCitation[] = [first, second, third].map((dataset, i) => ({number: i + 1, dataset}));

// The Play button reads the search params.
const renderList = (ui = <CitedDatasets citations={citations}/>) => render(<MemoryRouter>{ui}</MemoryRouter>);

describe("CitedDatasets", () => {
    it("lists the cited datasets in citation order with number, title, byline and actions", () => {
        renderList();
        const items = screen.getAllByRole("listitem");
        expect(items).toHaveLength(3);
        expect(items[0]).toHaveTextContent("[1]");
        expect(items[0]).toHaveTextContent("Ocean Temperatures 2023");
        expect(items[1]).toHaveTextContent("2021 · Ada, Bo, +1 more");
        expect(within(items[2]).getByRole("link", {name: /source of dataset Reactor Steel SEM/}))
            .toHaveAttribute("href", third._id);
    });

    it("counts the cited datasets per repository, by name", () => {
        renderList();
        expect(screen.getByTitle("2 of 3 cited datasets from Zenodo")).toHaveTextContent("Zenodo2");
        expect(screen.getByTitle("1 of 3 cited datasets from PaNOSC")).toHaveTextContent("PaNOSC1");
    });

    it("expands a row into the card details", async () => {
        const user = userEvent.setup();
        renderList();
        expect(screen.queryByText(/^x{300}\.\.\.$/)).not.toBeInTheDocument();
        await user.click(screen.getByRole("button", {name: "Show details of Soil Moisture 2021"}));
        expect(screen.getByText(/^x{300}\.\.\.$/)).toBeInTheDocument();
        expect(screen.getByText("2021.03.02")).toBeInTheDocument();
    });

    it("can be hidden, and a marker jump reopens it on the right entry", async () => {
        const user = userEvent.setup();
        const {rerender} = renderList();
        await user.click(screen.getByRole("button", {name: /Hide list/}));
        expect(screen.queryByRole("list")).not.toBeInTheDocument();
        expect(screen.getByRole("button", {name: /Show all 3/})).toBeInTheDocument();

        const scrollIntoView = vi.fn();
        Element.prototype.scrollIntoView = scrollIntoView;
        rerender(<MemoryRouter><CitedDatasets citations={citations} jump={{number: 2, seq: 1}}/></MemoryRouter>);

        const items = screen.getAllByRole("listitem");
        expect(items).toHaveLength(3);
        expect(scrollIntoView).toHaveBeenCalled();
        expect(items[1]).toHaveFocus();
        expect(items[1].className).toContain("bg-blue-100");
    });

    it("renders nothing without citations", () => {
        const {container} = renderList(<CitedDatasets citations={[]}/>);
        expect(container).toBeEmptyDOMElement();
    });
});
