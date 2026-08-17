// Signed download URLs for the file-preview proxy.
//
// The proxy must only ever fetch a URL that the server itself produced (from
// datahugger), otherwise a user could steer it at an arbitrary host. That used
// to be enforced with an in-memory allowlist Set, which silently breaks in
// production: `npm run prod` runs pm2 in cluster mode, so the worker that
// serves /files is usually not the worker that serves /file-preview, and the
// preview was rejected with a 403 the UI reported as "Preview not available".
//
// A keyed signature carries the same guarantee without per-process state, so it
// works across workers and across restarts.

import {createHmac, randomBytes, timingSafeEqual} from "node:crypto";
import {openSync, readFileSync, writeSync, closeSync} from "node:fs";
import {tmpdir} from "node:os";
import path from "node:path";

/** How long a signed preview URL stays valid. Generous: the signature travels
 *  with file metadata the client may hold for a whole browsing session. */
const TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

const SECRET_FILE = path.join(tmpdir(), "matchmaker-preview-secret");

let secret: Buffer | null = null;

/**
 * Resolve the signing key. PREVIEW_URL_SECRET is the deployment path and is the
 * only option that holds when the frontend runs as more than one container.
 * Without it we fall back to a file in the OS temp dir, which every pm2 worker
 * in a container shares — correct for the single-container deployment, and no
 * worse than the old allowlist for anything wider.
 */
function getSecret(): Buffer {
    if (secret) return secret;

    const fromEnv = process.env.PREVIEW_URL_SECRET;
    if (fromEnv) {
        secret = Buffer.from(fromEnv, "utf-8");
        return secret;
    }

    secret = readOrCreateSecretFile();
    console.warn(
        `PREVIEW_URL_SECRET is not set; using the shared secret at ${SECRET_FILE}. ` +
        "Set PREVIEW_URL_SECRET if the frontend runs as more than one instance.",
    );
    return secret;
}

function readOrCreateSecretFile(): Buffer {
    try {
        // "wx" fails if the file exists, so concurrently starting workers cannot
        // clobber each other's key — the loser reads what the winner wrote.
        const fd = openSync(SECRET_FILE, "wx", 0o600);
        try {
            const generated = randomBytes(32);
            writeSync(fd, generated);
            return generated;
        } finally {
            closeSync(fd);
        }
    } catch {
        return readFileSync(SECRET_FILE);
    }
}

const digest = (url: string, expiresAt: number): Buffer =>
    createHmac("sha256", getSecret()).update(`${url}\n${expiresAt}`).digest();

/** Sign a download URL for the preview proxy. Returns an opaque `<exp>.<mac>`. */
export function signPreviewUrl(url: string, now = Date.now()): string {
    const expiresAt = now + TOKEN_TTL_MS;
    return `${expiresAt}.${digest(url, expiresAt).toString("base64url")}`;
}

/** A plain string union rather than a tagged object: this project compiles with
 *  `strictNullChecks: false`, where narrowing on a boolean discriminant does not
 *  work. */
export type PreviewSignatureResult = "ok" | "invalid" | "expired";

/**
 * Check a signature produced by `signPreviewUrl` for exactly this URL.
 *
 * `signature` is deliberately `unknown`: it comes from a query parameter, which
 * Express will hand over as an array or an object if the caller repeats or
 * indexes it. Anything that is not a string is rejected here rather than
 * silently coerced by the string operations below.
 */
export function verifyPreviewUrl(
    url: string,
    signature: unknown,
    now = Date.now(),
): PreviewSignatureResult {
    if (typeof signature !== "string" || !signature) return "invalid";

    const separator = signature.indexOf(".");
    if (separator < 0) return "invalid";

    const expiresAt = Number(signature.slice(0, separator));
    if (!Number.isSafeInteger(expiresAt)) return "invalid";

    const mac = Buffer.from(signature.slice(separator + 1), "base64url");
    const expected = digest(url, expiresAt);
    if (mac.length !== expected.length || !timingSafeEqual(mac, expected)) {
        return "invalid";
    }

    // Expiry is only meaningful once the signature is authentic, otherwise the
    // caller picks the expiry and the check says nothing.
    if (now > expiresAt) return "expired";

    return "ok";
}
