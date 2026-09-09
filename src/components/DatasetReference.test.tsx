import {describe, it, expect, vi} from "vitest";
import {fireEvent, render, screen} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

    it("still leads to the reference when the pill cannot be linked", async () => {
        const onJump = vi.fn();
        render(
            <DatasetReference dataset={makeDataset({dataset_url: "javascript:alert(1)"})} number={2} onJump={onJump}/>,
        );
        const pill = screen.getByRole("button", {name: /Test Dataset Title/});
        expect(pill).toHaveTextContent("[2]");
        await userEvent.click(pill);
        expect(onJump).toHaveBeenCalledWith(2);
    });

    // The pill is one control with one apparent action, but it stays a real link so the
    // browser's own ways of opening a source keep working.
    const clickWith = (init: MouseEventInit) => {
        const pill = screen.getByRole("link", {name: /Ocean Temperatures 2023/});
        return fireEvent(pill, new MouseEvent("click", {bubbles: true, cancelable: true, ...init}));
    };

    it("jumps to the reference on a plain click rather than following the link", () => {
        const onJump = vi.fn();
        render(
            <DatasetReference
                dataset={makeDataset({dataset_url: DATASET_URL, title: "Ocean Temperatures 2023"})}
                number={1}
                onJump={onJump}
            />,
        );
        // dispatchEvent reports false once preventDefault has stopped the navigation.
        expect(clickWith({})).toBe(false);
        expect(onJump).toHaveBeenCalledWith(1);
    });

    it("leaves a modifier-click to the browser, so sources can be opened in background tabs", () => {
        const onJump = vi.fn();
        render(
            <DatasetReference
                dataset={makeDataset({dataset_url: DATASET_URL, title: "Ocean Temperatures 2023"})}
                number={1}
                onJump={onJump}
            />,
        );
        for (const modifier of [{ctrlKey: true}, {metaKey: true}, {shiftKey: true}]) {
            expect(clickWith(modifier)).toBe(true);
        }
        expect(onJump).not.toHaveBeenCalled();
    });
});
