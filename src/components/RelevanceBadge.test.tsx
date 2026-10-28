import {describe, it, expect} from "vitest";
import {render, screen} from "@testing-library/react";
import {makeDataset} from "@/test/fixtures/datasets";
import {RelevanceBadge} from "./SearchResultItem";

// The visible text is just the percentage; "Relevance" is a screen-reader prefix and the
// explanation lives in the hover title. Matches the label span as a whole, since its text
// is split across the sr-only prefix and the number.
const getLabel = (text: string) =>
    screen.getByText((_content, el) => el?.tagName === "SPAN" && el.textContent === text);

describe("RelevanceBadge", () => {
    it("shows the rerank score as a bare percentage with a screen-reader label", () => {
        render(<RelevanceBadge hit={makeDataset({_score: 1.0, score: 0.9592})}/>);
        expect(getLabel("Relevance 96%")).toBeInTheDocument();
        expect(screen.getByText("Relevance")).toHaveClass("sr-only");
    });

    it("explains the score on hover", () => {
        const {container} = render(<RelevanceBadge hit={makeDataset({score: 0.9592})}/>);
        expect(container.firstElementChild).toHaveAttribute("title", expect.stringMatching(/^Relevance: /));
    });

    it("ignores the retrieval score, which is not comparable across hits", () => {
        render(<RelevanceBadge hit={makeDataset({_score: 0.3, score: 0.9908})}/>);
        expect(getLabel("Relevance 99%")).toBeInTheDocument();
        expect(screen.queryByText(/30%/)).not.toBeInTheDocument();
    });

    it("caps a score just below 1 at 99% rather than rounding up to 100%", () => {
        render(<RelevanceBadge hit={makeDataset({score: 0.9986})}/>);
        expect(getLabel("Relevance 99%")).toBeInTheDocument();
    });

    it("shows 100% only for an exact score of 1", () => {
        render(<RelevanceBadge hit={makeDataset({score: 1})}/>);
        expect(getLabel("Relevance 100%")).toBeInTheDocument();
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
        expect(getLabel("Relevance 0%")).toBeInTheDocument();
        expect(screen.getByRole("img")).toHaveAccessibleName("0%");
    });
});
