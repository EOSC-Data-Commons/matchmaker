import React from "react";
import {describe, it, expect, vi} from "vitest";
import {render, screen} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {ToolSearchInput, ToolSelectionStep} from "./ToolSelectionStep";

/** The input as a controlled field, the way the page uses it. */
function Harness({onSearch, isSearching = false}: { onSearch: (text: string) => void; isSearching?: boolean }) {
    const [value, setValue] = React.useState("");
    return <ToolSearchInput value={value} onChange={setValue} onSearch={onSearch} isSearching={isSearching}/>;
}


describe("ToolSearchInput", () => {
    it("does not search while typing", async () => {
        const onSearch = vi.fn();
        render(<Harness onSearch={onSearch}/>);

        await userEvent.type(screen.getByLabelText("Search for a tool"), "jupyter");

        expect(onSearch).not.toHaveBeenCalled();
    });

    it("searches the typed text on Enter", async () => {
        const onSearch = vi.fn();
        render(<Harness onSearch={onSearch}/>);

        await userEvent.type(screen.getByLabelText("Search for a tool"), "jupyter{Enter}");

        expect(onSearch).toHaveBeenCalledTimes(1);
        expect(onSearch).toHaveBeenCalledWith("jupyter");
    });

    it("searches the typed text from the search button", async () => {
        const onSearch = vi.fn();
        render(<Harness onSearch={onSearch}/>);

        await userEvent.type(screen.getByLabelText("Search for a tool"), "python");
        await userEvent.click(screen.getByRole("button", {name: "Search tools"}));

        expect(onSearch).toHaveBeenCalledTimes(1);
        expect(onSearch).toHaveBeenCalledWith("python");
    });

    it("clearing the box restores the default list without a submit", async () => {
        const onSearch = vi.fn();
        render(<Harness onSearch={onSearch}/>);
        const input = screen.getByLabelText("Search for a tool");

        await userEvent.type(input, "r");
        await userEvent.clear(input);

        expect(onSearch).toHaveBeenCalledTimes(1);
        expect(onSearch).toHaveBeenCalledWith("");
    });

    it("shows a spinner in place of the icon while a search runs", () => {
        render(<Harness onSearch={vi.fn()} isSearching/>);

        expect(screen.getByRole("status", {name: "Searching"})).toBeInTheDocument();
    });
});

describe("ToolSelectionStep", () => {
    it("picking a suggestion fills the box and searches it at once", async () => {
        const setToolSearchText = vi.fn();
        const onSearch = vi.fn();
        render(
            <ToolSelectionStep
                toolSearchText=""
                setToolSearchText={setToolSearchText}
                onSearch={onSearch}
                isSearching={false}
                isFilesLoading={false}
                queryToolResults={{}}
                handleToolSelect={vi.fn()}
                filesError={null}
                searchError={null}
                selectedToolId={null}
            />
        );

        await userEvent.click(screen.getByRole("button", {name: "jupyter"}));

        expect(setToolSearchText).toHaveBeenCalledWith("jupyter");
        expect(onSearch).toHaveBeenCalledWith("jupyter");
    });
});
