import {describe, it, expect, vi, beforeEach, afterEach} from "vitest";
import type {ReactNode} from "react";
import {render, screen} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {MemoryRouter} from "react-router";
import {SearchInput} from "./SearchInput";
import {loginForAiMode, returnedFromAiModeLogin} from "@/lib/authRedirect";

// loginForAiMode does a full-page navigation, which jsdom cannot perform.
vi.mock("@/lib/authRedirect", () => ({
    loginForAiMode: vi.fn(),
    returnedFromAiModeLogin: vi.fn(() => false),
}));

const wrapper = ({children}: {children: ReactNode}) => <MemoryRouter>{children}</MemoryRouter>;

const renderInput = (props: Partial<Parameters<typeof SearchInput>[0]> = {}) => {
    const onSearch = vi.fn();
    render(<SearchInput onSearch={onSearch} {...props}/>, {wrapper});
    return {onSearch, input: screen.getByRole("textbox")};
};

type Paq = Array<Array<string | number | boolean>>;
const events = () => (window._paq as unknown as Paq).filter(c => c[0] === "trackEvent");

describe("SearchInput", () => {
    beforeEach(() => {
        localStorage.clear();
        window._paq = [];
        vi.mocked(loginForAiMode).mockClear();
        vi.mocked(returnedFromAiModeLogin).mockReturnValue(false);
    });

    afterEach(() => {
        delete (window as Partial<Window>)._paq;
    });

    it("reports nothing itself on submit: the page owns Search/submitted", async () => {
        // This component is also the chat composer, where a submit used to be
        // counted as a search. The origin travels to the page instead.
        const user = userEvent.setup();
        localStorage.setItem("searchHistory", JSON.stringify(["ocean currents"]));
        const {onSearch, input} = renderInput();

        await user.click(input);
        await user.click(screen.getByText("ocean currents"));
        await user.type(input, "{Enter}");
        expect(onSearch).toHaveBeenNthCalledWith(1, "ocean currents", "cesnet/agentic", false, "history");
        expect(onSearch).toHaveBeenNthCalledWith(2, "ocean currents", "cesnet/agentic", false, "typed");
        expect(events()).toEqual([]);
    });

    it("submits the trimmed query with the default model", async () => {
        const user = userEvent.setup();
        const {onSearch, input} = renderInput();

        await user.type(input, "  climate data  ");
        await user.click(screen.getByRole("button", {name: "Search"}));

        expect(onSearch).toHaveBeenCalledExactlyOnceWith("climate data", "cesnet/agentic", false, "typed");
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
            expect(onSearch).toHaveBeenCalledExactlyOnceWith("climate data", "cesnet/agentic", false, "history");
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
            expect(onSearch).toHaveBeenCalledExactlyOnceWith("climate data", "cesnet/agentic", false, "history");
        });

        it("can be disabled entirely", async () => {
            const user = userEvent.setup();
            const {input} = renderInput({disableHistory: true});
            await user.click(input);
            expect(screen.queryByText("ocean currents")).not.toBeInTheDocument();
        });
    });

    describe("AI mode toggle", () => {
        it("defaults on once a signed-in user is known", async () => {
            const user = userEvent.setup();
            const onSearch = vi.fn();
            const props = {onSearch, showAiToggle: true};
            // The page renders before useAuth has the user.
            const {rerender} = render(<SearchInput {...props} isLoggedIn={false}/>, {wrapper});
            expect(screen.getByRole("button", {name: "Toggle AI mode"})).toHaveAttribute("aria-pressed", "false");

            rerender(<SearchInput {...props} isLoggedIn={true}/>);
            expect(screen.getByRole("button", {name: "Toggle AI mode"})).toHaveAttribute("aria-pressed", "true");
            expect(screen.queryByRole("button", {name: "Search"})).not.toBeInTheDocument();
            await user.type(screen.getByRole("textbox"), "ocean{Enter}");
            expect(onSearch).toHaveBeenCalledExactlyOnceWith("ocean", "cesnet/agentic", true, "typed");
        });

        it("brings the Search button back when turned off, and Ask AI when turned on again", async () => {
            const user = userEvent.setup();
            const {onSearch, input} = renderInput({showAiToggle: true, isLoggedIn: true});
            const toggle = screen.getByRole("button", {name: "Toggle AI mode"});

            await user.click(toggle);
            expect(screen.queryByRole("button", {name: "Ask AI"})).not.toBeInTheDocument();
            await user.type(input, "ocean");
            await user.click(screen.getByRole("button", {name: "Search"}));
            expect(onSearch).toHaveBeenCalledExactlyOnceWith("ocean", "cesnet/agentic", false, "typed");

            await user.click(toggle);
            expect(screen.queryByRole("button", {name: "Search"})).not.toBeInTheDocument();
            await user.click(screen.getByRole("button", {name: "Ask AI"}));
            expect(onSearch).toHaveBeenLastCalledWith("ocean", "cesnet/agentic", true, "typed");
        });

        it("reports each toggle as AI Mode/toggled with the new state", async () => {
            const user = userEvent.setup();
            renderInput({showAiToggle: true, isLoggedIn: true});
            const toggle = screen.getByRole("button", {name: "Toggle AI mode"});

            await user.click(toggle);
            await user.click(toggle);
            expect(events()).toEqual([
                ["trackEvent", "AI Mode", "toggled", "off"],
                ["trackEvent", "AI Mode", "toggled", "on"],
            ]);
        });

        it("reports no event of its own for an anonymous click: the login start covers it", async () => {
            const user = userEvent.setup();
            renderInput({showAiToggle: true, isLoggedIn: false});

            await user.click(screen.getByRole("button", {name: "Toggle AI mode"}));
            expect(loginForAiMode).toHaveBeenCalledOnce();
            expect(events()).toEqual([]);
        });

        it("stays off for anonymous users and sends them to log in", async () => {
            const user = userEvent.setup();
            const {onSearch, input} = renderInput({showAiToggle: true, isLoggedIn: false});

            // The chip is clickable rather than disabled: clicking it starts the login
            // flow, which is the only way an anonymous user can reach AI mode.
            await user.click(screen.getByRole("button", {name: "Toggle AI mode"}));
            expect(loginForAiMode).toHaveBeenCalledOnce();

            await user.type(input, "ocean{Enter}");
            expect(onSearch).toHaveBeenCalledExactlyOnceWith("ocean", "cesnet/agentic", false, "typed");
        });

        it("comes back on after a login started from the toggle", () => {
            vi.mocked(returnedFromAiModeLogin).mockReturnValue(true);
            // The results page starts off; the login return still turns it on.
            const props = {onSearch: vi.fn(), showAiToggle: true, initialAiMode: false};
            const {rerender} = render(<SearchInput {...props} isLoggedIn={false}/>, {wrapper});

            // Signed-in state is still loading: nothing on yet.
            expect(screen.getByRole("button", {name: "Toggle AI mode"})).toHaveAttribute("aria-pressed", "false");

            rerender(<SearchInput {...props} isLoggedIn={true}/>);
            expect(screen.getByRole("button", {name: "Toggle AI mode"})).toHaveAttribute("aria-pressed", "true");
            expect(screen.getByRole("button", {name: "Ask AI"})).toBeInTheDocument();
        });

        it("starts off when initialAiMode is false, as on the results page", async () => {
            const user = userEvent.setup();
            const {onSearch, input} = renderInput({
                showAiToggle: true,
                isLoggedIn: true,
                initialAiMode: false,
            });

            expect(screen.queryByRole("button", {name: "Ask AI"})).not.toBeInTheDocument();
            await user.type(input, "ocean{Enter}");
            expect(onSearch).toHaveBeenCalledExactlyOnceWith("ocean", "cesnet/agentic", false, "typed");
        });
    });

    it("clears the query with the clear button", async () => {
        const user = userEvent.setup();
        const {input} = renderInput();

        await user.type(input, "ocean");
        await user.click(screen.getByRole("button", {name: "Clear search"}));
        expect(input).toHaveValue("");
    });
});
