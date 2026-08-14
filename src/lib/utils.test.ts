import {describe, it, expect, vi, afterEach} from "vitest";
import {getUserErrorMessage, stripHtml, stripMarkdown, fetchWithTimeout, prettyJson, trimTrailingPartialLink, formatFileSize, describeResultCount} from "./utils";

describe("describeResultCount", () => {
    it("signals more results without quoting the inflated match total", () => {
        expect(describeResultCount(30, 30, 296193))
            .toBe("Showing the 30 most relevant datasets");
    });

    it("never prints totalFound, which counts any-word matches", () => {
        expect(describeResultCount(30, 30, 296193)).not.toContain("296");
        expect(describeResultCount(12, 30, 296193)).not.toContain("296");
    });

    it("compares against what was retrieved once a filter narrows the list", () => {
        expect(describeResultCount(12, 30, 296193))
            .toBe("Showing 12 of 30 datasets");
    });

    it("states a plain count when everything that matched was returned", () => {
        expect(describeResultCount(5, 5, 5)).toBe("Found 5 datasets");
        expect(describeResultCount(1, 1, 1)).toBe("Found 1 dataset");
    });
});

describe("formatFileSize", () => {
    it("formats across units", () => {
        expect(formatFileSize(0)).toBe("0 B");
        expect(formatFileSize(512)).toBe("512 B");
        expect(formatFileSize(2048)).toBe("2.0 KB");
        expect(formatFileSize(5242880)).toBe("5.0 MB");
        expect(formatFileSize(1024 ** 3 * 2.5)).toBe("2.5 GB");
    });

    it("drops the decimal above 10 units", () => {
        expect(formatFileSize(1024 * 240)).toBe("240 KB");
    });

    it("returns null when there is no usable size", () => {
        expect(formatFileSize(null)).toBeNull();
        expect(formatFileSize(undefined)).toBeNull();
        expect(formatFileSize(-1)).toBeNull();
        expect(formatFileSize(NaN)).toBeNull();
    });
});

describe("getUserErrorMessage", () => {
    // Vitest runs with MODE=test, so the non-dev branches apply.
    it("returns the message for Error instances", () => {
        expect(getUserErrorMessage(new Error("backend exploded"))).toBe("backend exploded");
    });

    it("returns a generic message for non-Error values", () => {
        expect(getUserErrorMessage("string error")).toBe("An unexpected error occurred.");
        expect(getUserErrorMessage(undefined)).toBe("An unexpected error occurred.");
        expect(getUserErrorMessage({code: 500})).toBe("An unexpected error occurred.");
    });
});

describe("stripMarkdown", () => {
    it("returns empty string for empty input", () => {
        expect(stripMarkdown("")).toBe("");
    });

    it("strips headings, bold and inline code", () => {
        expect(stripMarkdown("## Title\nThis is **bold** and `code`."))
            .toBe("Title\nThis is bold and code.");
    });

    it("keeps link text but drops the url", () => {
        expect(stripMarkdown("See [the docs](https://example.com) now")).toBe("See the docs now");
    });

    it("drops image markdown entirely", () => {
        expect(stripMarkdown("![a logo](https://example.com/logo.png)Jupyter")).toBe("Jupyter");
    });

    it("removes list markers and blockquotes", () => {
        expect(stripMarkdown("- one\n- two\n> quoted")).toBe("one\ntwo\nquoted");
    });
});

describe("stripHtml", () => {
    it("returns empty string for empty input", () => {
        expect(stripHtml("")).toBe("");
    });

    it("removes tags but keeps their text content", () => {
        expect(stripHtml("<p>Hello <b>world</b></p>")).toBe("Hello world");
    });

    it("drops script and style blocks including their content", () => {
        expect(stripHtml("before<script>alert(1)</script>after")).toBe("beforeafter");
        expect(stripHtml("a<style>.x{color:red}</style>b")).toBe("ab");
    });

    it("removes HTML comments", () => {
        expect(stripHtml("a<!-- hidden -->b")).toBe("ab");
    });

    it("decodes common entities", () => {
        expect(stripHtml("Fish &amp; Chips &lt;fresh&gt;&nbsp;&copy;2023")).toBe("Fish & Chips <fresh> ©2023");
    });

    it("leaves unknown entities untouched", () => {
        expect(stripHtml("&euro;100")).toBe("&euro;100");
    });
});

describe("fetchWithTimeout", () => {
    afterEach(() => {
        vi.unstubAllGlobals();
        vi.useRealTimers();
    });

    it("returns the response when fetch resolves in time", async () => {
        const response = new Response("ok");
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response));
        await expect(fetchWithTimeout("https://example.test/fast")).resolves.toBe(response);
    });

    it("rejects with a timeout message when the request exceeds the deadline", async () => {
        vi.useFakeTimers();
        vi.stubGlobal(
            "fetch",
            vi.fn((_url: string, opts: RequestInit) =>
                new Promise((_resolve, reject) => {
                    opts.signal?.addEventListener("abort", () => {
                        const err = new Error("aborted");
                        err.name = "AbortError";
                        reject(err);
                    });
                }),
            ),
        );
        const pending = fetchWithTimeout("https://example.test/slow", {}, 5000);
        const assertion = expect(pending).rejects.toThrow("Request timeout after 5 seconds");
        await vi.advanceTimersByTimeAsync(5000);
        await assertion;
    });

    it("passes through non-abort fetch errors unchanged", async () => {
        vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("connection refused")));
        await expect(fetchWithTimeout("https://example.test/down")).rejects.toThrow("connection refused");
    });
});

describe("prettyJson", () => {
    it("indents JSON with 2 spaces and passes plain text through", () => {
        expect(prettyJson('{"a":1}')).toBe('{\n  "a": 1\n}');
        expect(prettyJson("not json")).toBe("not json");
    });
});

describe("trimTrailingPartialLink", () => {
    it("hides a half-streamed link and keeps complete ones", () => {
        expect(trimTrailingPartialLink("See [Global Carbon](https://doi.org/1) and [Air qual")).toBe(
            "See [Global Carbon](https://doi.org/1) and ",
        );
        expect(trimTrailingPartialLink("See [Global Carbon](https://doi.org/1)")).toBe(
            "See [Global Carbon](https://doi.org/1)",
        );
        expect(trimTrailingPartialLink("no links here")).toBe("no links here");
    });
});
