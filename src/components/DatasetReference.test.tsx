import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {fireEvent, render, screen} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {makeDataset} from "@/test/fixtures/datasets";
import {DatasetReference} from "./DatasetReference";

const DATASET_URL = "https://doi.org/10.5281/zenodo.1234567";

type Paq = Array<Array<string | number | boolean>>;
const paq = () => window._paq as unknown as Paq;

describe("DatasetReference", () => {
    beforeEach(() => {
        window._paq = [];
    });

    afterEach(() => {
        delete (window as Partial<Window>)._paq;
    });

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

    // For tests about what is counted, not about navigation: keeps happy-dom from
    // following the link to doi.org.
    const holdLink = () => {
        screen.getByRole("link", {name: /Ocean Temperatures 2023/})
            .addEventListener("click", event => event.preventDefault());
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

    it("follows the link on a plain click when nothing handles the jump", () => {
        // The printable export shows numbered pills with no reference list to jump to.
        render(
            <DatasetReference
                dataset={makeDataset({dataset_url: DATASET_URL, title: "Ocean Temperatures 2023"})}
                number={1}
            />,
        );
        expect(screen.getByRole("link", {name: /Ocean Temperatures 2023/})).toHaveTextContent("[1]");
        expect(clickWith({})).toBe(true);
    });

    it("counts a jump to the reference, and a source opened from inside an answer by its repository", () => {
        render(
            <DatasetReference
                dataset={makeDataset({dataset_url: DATASET_URL, title: "Ocean Temperatures 2023", _source: {_repo: "Zenodo"}})}
                number={1}
                onJump={vi.fn()}
            />,
        );
        holdLink();
        clickWith({});
        expect(paq()).toEqual([["trackEvent", "AI Mode", "reference_jumped"]]);

        clickWith({ctrlKey: true});
        // The repository code, never the dataset's title.
        expect(paq()[1]).toEqual(["trackEvent", "Dataset", "source_opened", "ai_answer:zenodo"]);
    });

    it("names where it was shown when the source is opened from somewhere other than an answer", () => {
        render(
            <DatasetReference
                dataset={makeDataset({dataset_url: DATASET_URL, title: "Ocean Temperatures 2023"})}
                number={1}
                context="export"
            />,
        );
        holdLink();
        clickWith({});
        expect(paq()).toEqual([["trackEvent", "Dataset", "source_opened", "export:unknown"]]);
    });
});
