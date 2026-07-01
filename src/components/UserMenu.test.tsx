import {describe, it, expect, vi} from "vitest";
import {render, screen, fireEvent} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type {UserInfo} from "@/types/user";
import {UserMenu} from "./UserMenu";

const jane: UserInfo = {sub: "u1", email: "jane@example.org", name: "Jane Doe"};

describe("UserMenu", () => {
    it("shows the user's initials on the trigger", () => {
        render(<UserMenu user={jane} onLogout={() => {}}/>);
        expect(screen.getByRole("button", {name: /user menu/i})).toHaveTextContent("JD");
    });

    it("opens the menu with name, email and logout", async () => {
        const user = userEvent.setup();
        const onLogout = vi.fn();
        render(<UserMenu user={jane} onLogout={onLogout}/>);

        await user.click(screen.getByRole("button", {name: /user menu/i}));
        expect(screen.getByText("Jane Doe")).toBeInTheDocument();
        expect(screen.getByText("jane@example.org")).toBeInTheDocument();

        await user.click(screen.getByRole("menuitem", {name: "Log out"}));
        expect(onLogout).toHaveBeenCalledOnce();
    });

    it("only offers API Keys when a profile handler is provided", async () => {
        const user = userEvent.setup();
        const {rerender} = render(<UserMenu user={jane} onLogout={() => {}}/>);
        await user.click(screen.getByRole("button", {name: /user menu/i}));
        expect(screen.queryByRole("menuitem", {name: "API Keys"})).not.toBeInTheDocument();

        const onProfile = vi.fn();
        rerender(<UserMenu user={jane} onLogout={() => {}} onProfile={onProfile}/>);
        await user.click(screen.getByRole("menuitem", {name: "API Keys"}));
        expect(onProfile).toHaveBeenCalledOnce();
        // Selecting an item closes the menu
        expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    });

    it("closes on an outside click", async () => {
        const user = userEvent.setup();
        render(<UserMenu user={jane} onLogout={() => {}}/>);
        await user.click(screen.getByRole("button", {name: /user menu/i}));
        expect(screen.getByRole("menu")).toBeInTheDocument();

        fireEvent.mouseDown(document.body);
        expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    });
});
