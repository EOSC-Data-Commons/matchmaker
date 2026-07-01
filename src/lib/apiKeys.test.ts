import {describe, it, expect, vi, beforeEach, afterEach} from "vitest";
import {http, HttpResponse} from "msw";
import {server} from "@/test/msw/server";
import {
    API_KEYS,
    SecretStoreUnavailableError,
    listApiKeys,
    getApiKey,
    saveApiKey,
    deleteApiKey,
} from "./apiKeys";

beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {
    });
});
afterEach(() => {
    vi.restoreAllMocks();
});

describe("API_KEYS registry", () => {
    it("keeps the Vault key ids stable (contract with data-commons-search)", () => {
        // These ids are Vault path segments read by the backend — renaming one
        // silently orphans every user's stored secret.
        expect(API_KEYS.map(k => k.id)).toEqual(["vip", "github"]);
    });
});

describe("listApiKeys", () => {
    it("returns the stored key ids and sends credentials", async () => {
        let credentials: string | undefined;
        server.use(
            http.get("/auth/keys", ({request}) => {
                credentials = request.credentials;
                return HttpResponse.json({key_ids: ["vip", "github"]});
            }),
        );
        await expect(listApiKeys()).resolves.toEqual(["vip", "github"]);
        expect(credentials).toBe("include");
    });

    it("returns an empty list when key_ids is missing", async () => {
        server.use(http.get("/auth/keys", () => HttpResponse.json({})));
        await expect(listApiKeys()).resolves.toEqual([]);
    });

    it("throws a login-required error on 401", async () => {
        // The live backend returns 401 for unauthenticated /auth/keys requests
        server.use(http.get("/auth/keys", () => new HttpResponse(null, {status: 401})));
        await expect(listApiKeys()).rejects.toThrow("You must be logged in to manage API keys.");
    });

    it("maps 5xx to SecretStoreUnavailableError with the FastAPI detail", async () => {
        server.use(http.get("/auth/keys", () =>
            HttpResponse.json({detail: "Vault is sealed"}, {status: 503}),
        ));
        const error = await listApiKeys().catch(e => e);
        expect(error).toBeInstanceOf(SecretStoreUnavailableError);
        expect(error.message).toBe("Vault is sealed");
    });

    it("falls back to status text when the error body is not JSON", async () => {
        server.use(http.get("/auth/keys", () =>
            new HttpResponse("Proxy error", {status: 502, statusText: "Bad Gateway"}),
        ));
        const error = await listApiKeys().catch(e => e);
        expect(error).toBeInstanceOf(SecretStoreUnavailableError);
        expect(error.message).toBe("502 Bad Gateway");
    });

    it("maps network failures to SecretStoreUnavailableError", async () => {
        server.use(http.get("/auth/keys", () => HttpResponse.error()));
        await expect(listApiKeys()).rejects.toBeInstanceOf(SecretStoreUnavailableError);
    });
});

describe("getApiKey", () => {
    it("reads the new response schema ({id, value})", async () => {
        server.use(http.get("/auth/keys/vip", () =>
            HttpResponse.json({id: "vip", value: "secret-1"}),
        ));
        await expect(getApiKey("vip")).resolves.toBe("secret-1");
    });

    it("reads the old verbose schema ({key_id, key_value}) still used in prod", async () => {
        server.use(http.get("/auth/keys/vip", () =>
            HttpResponse.json({key_id: "vip", key_value: "secret-2"}),
        ));
        await expect(getApiKey("vip")).resolves.toBe("secret-2");
    });

    it("throws 'not set' on 404", async () => {
        server.use(http.get("/auth/keys/vip", () => new HttpResponse(null, {status: 404})));
        await expect(getApiKey("vip")).rejects.toThrow("This key is not set.");
    });

    it("rejects responses matching neither schema", async () => {
        server.use(http.get("/auth/keys/vip", () => HttpResponse.json({unexpected: true})));
        await expect(getApiKey("vip")).rejects.toThrow("Unexpected response from secret store.");
    });

    it("percent-encodes the key id in the path", async () => {
        let path = "";
        server.use(http.get("/auth/keys/:id", ({request}) => {
            path = new URL(request.url).pathname;
            return HttpResponse.json({value: "v"});
        }));
        await getApiKey("odd/id");
        expect(path).toBe("/auth/keys/odd%2Fid");
    });
});

describe("saveApiKey", () => {
    it("PUTs the value in the backend's key_value envelope", async () => {
        let body: unknown;
        server.use(http.put("/auth/keys/github", async ({request}) => {
            body = await request.json();
            return new HttpResponse(null, {status: 204});
        }));
        await expect(saveApiKey("github", "ghp_abc123")).resolves.toBeUndefined();
        expect(body).toEqual({key_value: "ghp_abc123"});
    });

    it("throws the backend detail on failure", async () => {
        server.use(http.put("/auth/keys/github", () =>
            HttpResponse.json({detail: "value too long"}, {status: 422}),
        ));
        await expect(saveApiKey("github", "x")).rejects.toThrow("value too long");
    });
});

describe("deleteApiKey", () => {
    it("resolves on success", async () => {
        server.use(http.delete("/auth/keys/vip", () => new HttpResponse(null, {status: 204})));
        await expect(deleteApiKey("vip")).resolves.toBeUndefined();
    });

    it("throws on failure", async () => {
        server.use(http.delete("/auth/keys/vip", () => new HttpResponse(null, {status: 500})));
        await expect(deleteApiKey("vip")).rejects.toThrow("500");
    });
});
