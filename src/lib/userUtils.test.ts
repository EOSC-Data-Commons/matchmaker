import {describe, it, expect} from "vitest";
import {getUserInitials} from "./userUtils";

describe("getUserInitials", () => {
    it("returns 'U' for missing users", () => {
        expect(getUserInitials(null)).toBe("U");
        expect(getUserInitials(undefined)).toBe("U");
    });

    it("uses first letters of the first two name parts", () => {
        expect(getUserInitials({name: "Jane Doe", email: "jane@example.org"})).toBe("JD");
        expect(getUserInitials({name: "Jane van Doe", email: "jane@example.org"})).toBe("JV");
    });

    it("handles extra whitespace in names", () => {
        expect(getUserInitials({name: "  Jane   Doe  ", email: "jane@example.org"})).toBe("JD");
    });

    it("uses the first two letters of a single-word name", () => {
        expect(getUserInitials({name: "Plato", email: "plato@example.org"})).toBe("PL");
    });

    it("falls back to preferred_username, then email", () => {
        expect(getUserInitials({preferred_username: "jdoe", email: "x@example.org"})).toBe("JD");
        expect(getUserInitials({email: "someone@example.org"})).toBe("SO");
    });

    it("returns 'U' when all fields are empty", () => {
        expect(getUserInitials({name: "", preferred_username: " ", email: ""})).toBe("U");
    });
});
