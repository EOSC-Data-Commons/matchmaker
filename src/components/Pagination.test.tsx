import {describe, it, expect, vi} from "vitest";
import {render, screen} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {Pagination} from "./Pagination";

describe("Pagination", () => {
    it("renders nothing when everything fits on one page", () => {
        const {container} = render(
            <Pagination page={1} size={10} total={10} onPageChange={() => {}}/>,
        );
        expect(container).toBeEmptyDOMElement();
    });

    it("shows the current position", () => {
        render(<Pagination page={2} size={10} total={95} onPageChange={() => {}}/>);
        expect(screen.getByText("Page 2 of 10")).toBeInTheDocument();
    });

    it("disables Previous on the first page and Next on the last", () => {
        const {rerender} = render(
            <Pagination page={1} size={10} total={30} onPageChange={() => {}}/>,
        );
        expect(screen.getByRole("button", {name: "Previous"})).toBeDisabled();
        expect(screen.getByRole("button", {name: "Next"})).toBeEnabled();

        rerender(<Pagination page={3} size={10} total={30} onPageChange={() => {}}/>);
        expect(screen.getByRole("button", {name: "Previous"})).toBeEnabled();
        expect(screen.getByRole("button", {name: "Next"})).toBeDisabled();
    });

    it("navigates one page at a time", async () => {
        const user = userEvent.setup();
        const onPageChange = vi.fn();
        render(<Pagination page={2} size={10} total={30} onPageChange={onPageChange}/>);

        await user.click(screen.getByRole("button", {name: "Next"}));
        expect(onPageChange).toHaveBeenCalledWith(3);

        await user.click(screen.getByRole("button", {name: "Previous"}));
        expect(onPageChange).toHaveBeenCalledWith(1);
    });

    it("formats large page counts with en-GB separators", () => {
        render(<Pagination page={1} size={1} total={2500} onPageChange={() => {}}/>);
        expect(screen.getByText("Page 1 of 2,500")).toBeInTheDocument();
    });
});
