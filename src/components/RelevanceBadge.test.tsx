import {describe, it, expect} from "vitest";
import {render, screen} from "@testing-library/react";
import {makeDataset} from "@/test/fixtures/datasets";
import {RelevanceBadge} from "./SearchResultItem";

describe("RelevanceBadge", () => {
    it("shows the rerank score with a visible label", () => {
        render(<RelevanceBadge hit={makeDataset({_score: 1.0, score: 0.9592})}/>);
        expect(screen.getByText("Relevance 96%")).toBeInTheDocument();
    });

    it("ignores the retrieval score, which is not comparable across hits", () => {
        render(<RelevanceBadge hit={makeDataset({_score: 0.3, score: 0.9908})}/>);
        expect(screen.getByText("Relevance 99%")).toBeInTheDocument();
        expect(screen.queryByText(/30%/)).not.toBeInTheDocument();
    });

    it("caps a score just below 1 at 99% rather than rounding up to 100%", () => {
        render(<RelevanceBadge hit={makeDataset({score: 0.9986})}/>);
        expect(screen.getByText("Relevance 99%")).toBeInTheDocument();
    });

    it("shows 100% only for an exact score of 1", () => {
        render(<RelevanceBadge hit={makeDataset({score: 1})}/>);
        expect(screen.getByText("Relevance 100%")).toBeInTheDocument();
    });

    it.each([
        ["null", null],
        ["missing", undefined],
    ])("renders nothing when the score is %s", (_label, score) => {
        const {container} = render(<RelevanceBadge hit={makeDataset({_score: 1.0, score})}/>);
        expect(container).toBeEmptyDOMElement();
    });

    it("keeps a score under 1% as an empty star rather than a full one", () => {
        render(<RelevanceBadge hit={makeDataset({score: 0.004})}/>);
        expect(screen.getByText("Relevance 0%")).toBeInTheDocument();
        expect(screen.getByRole("img")).toHaveAccessibleName("0%");
    });
});
