import {beforeAll, describe, expect, it, vi} from "vitest";

import {signPreviewUrl, verifyPreviewUrl} from "./previewSigning";

const URL_A = "https://zenodo.org/api/records/7702229/files/small_reg.png/content";
const URL_B = "https://zenodo.org/api/records/7702229/files/small_cor.png/content";

beforeAll(() => {
    // Pin the key so the test never touches the temp-dir fallback.
    process.env.PREVIEW_URL_SECRET = "test-secret";
});

describe("preview URL signing", () => {
    it("accepts a signature for the URL it was issued for", () => {
        expect(verifyPreviewUrl(URL_A, signPreviewUrl(URL_A))).toBe("ok");
    });

    it("rejects a signature replayed onto a different URL", () => {
        expect(verifyPreviewUrl(URL_B, signPreviewUrl(URL_A))).toBe("invalid");
    });

    it("rejects a missing or malformed signature", () => {
        for (const sig of [undefined, "", "nodot", ".", "notanumber.abc", `${Date.now()}.`]) {
            expect(verifyPreviewUrl(URL_A, sig)).toBe("invalid");
        }
    });

    it("rejects an unsigned URL even when it looks plausible", () => {
        const farFuture = Date.now() + 60_000;
        expect(verifyPreviewUrl(URL_A, `${farFuture}.${Buffer.alloc(32).toString("base64url")}`)).toBe("invalid");
    });

    it("reports expiry separately so the UI can ask for a reload", () => {
        const issuedYesterday = Date.now() - 25 * 60 * 60 * 1000;
        expect(verifyPreviewUrl(URL_A, signPreviewUrl(URL_A, issuedYesterday))).toBe("expired");
    });

    it("does not let a forged expiry turn into an 'expired' answer", () => {
        // A tampered token must read as invalid, never as merely stale.
        const signature = signPreviewUrl(URL_A);
        const tampered = `${Date.now() - 1000}.${signature.split(".")[1]}`;
        expect(verifyPreviewUrl(URL_A, tampered)).toBe("invalid");
    });

    // The bug this replaces: /files and /file-preview are served by different pm2
    // cluster workers, so anything held in one process's memory is invisible to
    // the other. A freshly loaded module stands in for that sibling worker.
    it("verifies a signature issued by another module instance", async () => {
        const signature = signPreviewUrl(URL_A);

        vi.resetModules();
        const sibling = await import("./previewSigning");

        expect(sibling.verifyPreviewUrl(URL_A, signature)).toBe("ok");
    });

    it("agrees between instances on the temp-file secret when PREVIEW_URL_SECRET is unset", async () => {
        delete process.env.PREVIEW_URL_SECRET;
        try {
            vi.resetModules();
            const issuer = await import("./previewSigning");
            vi.resetModules();
            const verifier = await import("./previewSigning");

            expect(verifier.verifyPreviewUrl(URL_A, issuer.signPreviewUrl(URL_A))).toBe("ok");
        } finally {
            process.env.PREVIEW_URL_SECRET = "test-secret";
        }
    });
});
