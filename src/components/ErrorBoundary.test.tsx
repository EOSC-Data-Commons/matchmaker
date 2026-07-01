import {describe, it, expect, vi, beforeEach, afterEach} from "vitest";
import {render, screen} from "@testing-library/react";
import {ErrorBoundary} from "./ErrorBoundary";

const Boom = () => {
    throw new Error("kaboom");
};

describe("ErrorBoundary", () => {
    beforeEach(() => {
        // React logs caught render errors loudly; keep test output readable
        vi.spyOn(console, "error").mockImplementation(() => {});
    });
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("renders children when nothing throws", () => {
        render(<ErrorBoundary><p>all good</p></ErrorBoundary>);
        expect(screen.getByText("all good")).toBeInTheDocument();
    });

    it("shows the fallback with the error message instead of a white screen", () => {
        render(<ErrorBoundary><Boom/></ErrorBoundary>);
        expect(screen.getByText("Something went wrong.")).toBeInTheDocument();
        expect(screen.getByText("kaboom")).toBeInTheDocument();
    });
});
