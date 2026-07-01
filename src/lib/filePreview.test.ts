import {describe, it, expect} from "vitest";
import type {FileMeta} from "@/types/dataplayerTypes";
import {getPreviewKind, isPreviewable, parseCsvRows, CSV_PREVIEW_ROWS} from "./filePreview";

const makeFile = (overrides: Partial<FileMeta> = {}): FileMeta => ({
    downloadUrl: "https://example.test/file",
    dataPath: "/data/file.txt",
    filename: "file.txt",
    size: "1.2 MB",
    hash: null,
    hash_type: "md5",
    isDir: false,
    ...overrides,
});

describe("getPreviewKind", () => {
    it("detects CSV by mimetype or extension", () => {
        expect(getPreviewKind(makeFile({mimetype: "text/csv", filename: "data.bin"}))).toBe("csv");
        expect(getPreviewKind(makeFile({mimetype: undefined, filename: "data.csv"}))).toBe("csv");
    });

    it("detects PDF and images", () => {
        expect(getPreviewKind(makeFile({mimetype: "application/pdf", filename: "doc"}))).toBe("pdf");
        expect(getPreviewKind(makeFile({mimetype: "image/png", filename: "pic"}))).toBe("image");
        expect(getPreviewKind(makeFile({mimetype: undefined, filename: "pic.SVG"}))).toBe("image");
    });

    it("detects text by mime prefix, JSON mimetype, or known extensions", () => {
        expect(getPreviewKind(makeFile({mimetype: "text/plain", filename: "notes"}))).toBe("text");
        expect(getPreviewKind(makeFile({mimetype: "application/json", filename: "data"}))).toBe("text");
        expect(getPreviewKind(makeFile({mimetype: undefined, filename: "script.py"}))).toBe("text");
        expect(getPreviewKind(makeFile({mimetype: undefined, filename: "syntax.sps"}))).toBe("text");
    });

    it("returns none for unknown types and extension-less files", () => {
        expect(getPreviewKind(makeFile({mimetype: "application/zip", filename: "archive.zip"}))).toBe("none");
        expect(getPreviewKind(makeFile({mimetype: undefined, filename: "README"}))).toBe("none");
    });
});

describe("isPreviewable", () => {
    it("requires both a download URL and a previewable kind", () => {
        expect(isPreviewable(makeFile({mimetype: "text/plain"}))).toBe(true);
        expect(isPreviewable(makeFile({mimetype: "text/plain", downloadUrl: undefined}))).toBe(false);
        expect(isPreviewable(makeFile({mimetype: "application/zip", filename: "a.zip"}))).toBe(false);
    });
});

describe("parseCsvRows", () => {
    it("parses simple comma-separated rows", () => {
        const {rows, hasMore, delimiter} = parseCsvRows("a,b,c\n1,2,3\n", 10);
        expect(rows).toEqual([["a", "b", "c"], ["1", "2", "3"]]);
        expect(hasMore).toBe(false);
        expect(delimiter).toBe(",");
    });

    it("sniffs semicolon delimiters (Dataverse NL style)", () => {
        const {rows, delimiter} = parseCsvRows("naam;waarde\nx;1\n", 10);
        expect(delimiter).toBe(";");
        expect(rows[0]).toEqual(["naam", "waarde"]);
    });

    it("sniffs tab delimiters", () => {
        const {rows, delimiter} = parseCsvRows("a\tb\n1\t2\n", 10);
        expect(delimiter).toBe("\t");
        expect(rows).toEqual([["a", "b"], ["1", "2"]]);
    });

    it("handles quoted fields containing delimiters and escaped quotes", () => {
        const {rows} = parseCsvRows('"hello, world","say ""hi"""\n', 10);
        expect(rows).toEqual([['hello, world', 'say "hi"']]);
    });

    it("does not count delimiters inside quotes when sniffing", () => {
        const {delimiter} = parseCsvRows('"a;b;c",x\n1,2\n', 10);
        expect(delimiter).toBe(",");
    });

    it("handles CRLF line endings", () => {
        const {rows} = parseCsvRows("a,b\r\n1,2\r\n", 10);
        expect(rows).toEqual([["a", "b"], ["1", "2"]]);
    });

    it("includes a trailing row without a final newline", () => {
        const {rows, hasMore} = parseCsvRows("a,b\n1,2", 10);
        expect(rows).toEqual([["a", "b"], ["1", "2"]]);
        expect(hasMore).toBe(false);
    });

    it("stops at maxRows and reports leftover content", () => {
        const text = Array.from({length: CSV_PREVIEW_ROWS + 10}, (_, i) => `row${i},x`).join("\n");
        const {rows, hasMore} = parseCsvRows(text, CSV_PREVIEW_ROWS);
        expect(rows).toHaveLength(CSV_PREVIEW_ROWS);
        expect(hasMore).toBe(true);
    });

    it("defaults to comma when no delimiter is found", () => {
        const {delimiter} = parseCsvRows("single-column\nvalue\n", 10);
        expect(delimiter).toBe(",");
    });
});
