import {describe, it, expect, vi, beforeEach} from "vitest";
import type {ReactNode} from "react";
import {render, screen} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {MemoryRouter} from "react-router";
import {SearchInput} from "./SearchInput";

const wrapper = ({children}: {children: ReactNode}) => <MemoryRouter>{children}</MemoryRouter>;

const renderInput = (props: Partial<Parameters<typeof SearchInput>[0]> = {}) => {
    const onSearch = vi.fn();
    render(<SearchInput onSearch={onSearch} {...props}/>, {wrapper});
    return {onSearch, input: screen.getByRole("textbox")};
};

describe("SearchInput", () => {
    beforeEach(() => {
        localStorage.clear();
    });

    it("submits the trimmed query with the default model", async () => {
        const user = userEvent.setup();
        const {onSearch, input} = renderInput();

        await user.type(input, "  climate data  ");
        await user.click(screen.getByRole("button", {name: "Search"}));

        expect(onSearch).toHaveBeenCalledExactlyOnceWith("climate data", "cesnet/agentic", false);
    });

    it("submits on Enter", async () => {
        const user = userEvent.setup();
        const {onSearch, input} = renderInput();
        await user.type(input, "ocean{Enter}");
        expect(onSearch).toHaveBeenCalledOnce();
    });

    it("ignores empty and whitespace-only queries", async () => {
        const user = userEvent.setup();
        const {onSearch, input} = renderInput();
        await user.type(input, "   {Enter}");
        await user.click(screen.getByRole("button", {name: "Search"}));
        expect(onSearch).not.toHaveBeenCalled();
    });

    it("does not submit while loading", async () => {
        const user = userEvent.setup();
        const {onSearch, input} = renderInput({loading: true});
        await user.type(input, "ocean{Enter}");
        expect(onSearch).not.toHaveBeenCalled();
        expect(screen.getByRole("button", {name: "Search"})).toBeDisabled();
    });

    it("clears the input after search when clearOnSearch is set", async () => {
        const user = userEvent.setup();
        const {input} = renderInput({clearOnSearch: true});
        await user.type(input, "ocean{Enter}");
        expect(input).toHaveValue("");
    });

    describe("history dropdown", () => {
        beforeEach(() => {
            localStorage.setItem("searchHistory", JSON.stringify(["ocean currents", "climate data"]));
        });

        it("suggests past searches on focus and searches on click", async () => {
            const user = userEvent.setup();
            const {onSearch, input} = renderInput();

            await user.click(input);
            expect(screen.getByText("ocean currents")).toBeInTheDocument();

            await user.click(screen.getByText("climate data"));
            expect(onSearch).toHaveBeenCalledExactlyOnceWith("climate data", "cesnet/agentic", false);
            expect(screen.queryByText("ocean currents")).not.toBeInTheDocument();
        });

        it("filters suggestions by the typed query", async () => {
            const user = userEvent.setup();
            const {input} = renderInput();

            await user.type(input, "oce");
            expect(screen.getByText("ocean currents")).toBeInTheDocument();
            expect(screen.queryByText("climate data")).not.toBeInTheDocument();
        });

        it("supports keyboard selection with arrows and Enter", async () => {
            const user = userEvent.setup();
            const {onSearch, input} = renderInput();

            await user.click(input);
            await user.keyboard("{ArrowDown}{ArrowDown}{Enter}");
            expect(onSearch).toHaveBeenCalledExactlyOnceWith("climate data", "cesnet/agentic", false);
        });

        it("can be disabled entirely", async () => {
            const user = userEvent.setup();
            const {input} = renderInput({disableHistory: true});
            await user.click(input);
            expect(screen.queryByText("ocean currents")).not.toBeInTheDocument();
        });
    });

    describe("AI mode toggle", () => {
        it("defaults on for logged-in users and reports aiMode=true", async () => {
            const user = userEvent.setup();
            const {onSearch, input} = renderInput({showAiToggle: true, isLoggedIn: true});

            await user.type(input, "ocean{Enter}");
            expect(onSearch).toHaveBeenCalledExactlyOnceWith("ocean", "cesnet/agentic", true);
        });

        it("can be toggled off", async () => {
            const user = userEvent.setup();
            const {onSearch, input} = renderInput({showAiToggle: true, isLoggedIn: true});

            await user.click(screen.getByRole("button", {name: "Toggle AI mode"}));
            await user.type(input, "ocean{Enter}");
            expect(onSearch).toHaveBeenCalledExactlyOnceWith("ocean", "cesnet/agentic", false);
        });

        it("is locked off for anonymous users, with a sign-in link", async () => {
            const user = userEvent.setup();
            const {onSearch, input} = renderInput({showAiToggle: true, isLoggedIn: false});

            expect(screen.getByRole("button", {name: "Toggle AI mode"})).toBeDisabled();
            expect(screen.getByRole("link", {name: "Sign in to unlock"})).toHaveAttribute("href", "/auth/login");

            await user.type(input, "ocean{Enter}");
            expect(onSearch).toHaveBeenCalledExactlyOnceWith("ocean", "cesnet/agentic", false);
        });
    });
});
