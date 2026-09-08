import {describe, it, expect} from "vitest";
import {render, screen} from "@testing-library/react";
import {makeDataset} from "@/test/fixtures/datasets";
import {DatasetReference} from "./DatasetReference";

const DATASET_URL = "https://doi.org/10.5281/zenodo.1234567";

describe("DatasetReference", () => {
    it("links the pill to the dataset's source URL", () => {
        render(<DatasetReference dataset={makeDataset({dataset_url: DATASET_URL, title: "Ocean Temperatures 2023"})}/>);
        const pill = screen.getByRole("link", {name: /Ocean Temperatures 2023/});
        expect(pill).toHaveAttribute("href", DATASET_URL);
        expect(pill).toHaveAttribute("rel", "noopener noreferrer");
    });

    it("falls back to the id when the dataset carries no URL", () => {
        render(<DatasetReference dataset={makeDataset({dataset_url: null, _id: DATASET_URL})}/>);
        expect(screen.getByRole("link", {name: /Test Dataset Title/})).toHaveAttribute("href", DATASET_URL);
    });

    it("names the dataset without linking it when the backend URL is not http(s)", () => {
        const {container} = render(
            <DatasetReference
                dataset={makeDataset({dataset_url: "javascript:alert(1)", title: "Ocean Temperatures 2023"})}/>,
        );
        expect(screen.queryByRole("link")).not.toBeInTheDocument();
        expect(screen.getByTitle("Ocean Temperatures 2023")).toHaveTextContent("Ocean Temperatures 2023");
        expect(container.innerHTML).not.toContain("javascript:");
    });

    it("does not link an id that is not a URL at all", () => {
        render(<DatasetReference dataset={makeDataset({dataset_url: null, _id: "ds-1"})}/>);
        expect(screen.queryByRole("link")).not.toBeInTheDocument();
        expect(screen.getByTitle("Test Dataset Title")).toBeInTheDocument();
    });

    it("keeps the [n] marker working when the pill cannot be linked", () => {
        render(<DatasetReference dataset={makeDataset({dataset_url: "javascript:alert(1)"})} number={2}/>);
        expect(screen.getByRole("button", {name: /^Reference 2:/})).toHaveTextContent("[2]");
    });
});
