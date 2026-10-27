import {describe, expect, it} from "vitest";

import {isLoginPath, withIdpHint} from "./idpHint";

// Shape of the redirect the backend's /auth/login answers with (values shortened).
const QUERY =
    "client_id=matchmaker&response_type=code&scope=openid+email+profile+voperson_id+offline_access" +
    "&redirect_uri=https%3A%2F%2Fdev.matchmaker.eosc-data-commons.eu%2Fapi%2Fsearch%2Fauth%2Fcallback" +
    "&state=abc&code_challenge=xyz&code_challenge_method=S256";
const PROD_AUTH = `https://aai.egi.eu/auth/realms/egi/protocol/openid-connect/auth?${QUERY}`;
const DEV_AUTH = `https://aai-dev.egi.eu/auth/realms/egi/protocol/openid-connect/auth?${QUERY}`;

describe("withIdpHint", () => {
    it("hints the production Check-in entry on aai.egi.eu", () => {
        expect(withIdpHint(PROD_AUTH)).toBe(`${PROD_AUTH}&kc_idp_hint=check-in`);
    });

    it("hints the devel Check-in entry on aai-dev.egi.eu", () => {
        expect(withIdpHint(DEV_AUTH)).toBe(`${DEV_AUTH}&kc_idp_hint=id-dev`);
    });

    it("leaves the backend's parameter encoding untouched", () => {
        const hinted = withIdpHint(PROD_AUTH);
        expect(hinted?.startsWith(PROD_AUTH)).toBe(true);
        expect(hinted).toContain("redirect_uri=https%3A%2F%2F");
        expect(hinted).toContain("scope=openid+email");
    });

    it("uses '?' when the URL has no query yet", () => {
        const bare = "https://aai.egi.eu/auth/realms/egi/protocol/openid-connect/auth";
        expect(withIdpHint(bare)).toBe(`${bare}?kc_idp_hint=check-in`);
    });

    it("does not add a second hint when one is already present", () => {
        expect(withIdpHint(`${PROD_AUTH}&kc_idp_hint=d4science`)).toBeUndefined();
    });

    it("ignores unknown issuer hosts", () => {
        expect(withIdpHint(`https://aai.eosc-federation.example/auth/realms/x/protocol/openid-connect/auth?${QUERY}`))
            .toBeUndefined();
    });

    it("ignores redirects that are not the authorization endpoint", () => {
        expect(withIdpHint("https://aai.egi.eu/auth/realms/egi/protocol/openid-connect/logout?x=1")).toBeUndefined();
        expect(withIdpHint("https://aai.egi.eu/")).toBeUndefined();
    });

    it("ignores relative or malformed locations", () => {
        expect(withIdpHint("/")).toBeUndefined();
        expect(withIdpHint("not a url")).toBeUndefined();
    });
});

describe("isLoginPath", () => {
    it("matches the login route with or without a query", () => {
        expect(isLoginPath("/auth/login")).toBe(true);
        expect(isLoginPath("/auth/login?redirect=%2Fchat")).toBe(true);
    });

    it("does not match logout, callback, or prefixes of login", () => {
        expect(isLoginPath("/auth/logout")).toBe(false);
        expect(isLoginPath("/auth/callback?code=1")).toBe(false);
        expect(isLoginPath("/auth/login-help")).toBe(false);
        expect(isLoginPath(undefined)).toBe(false);
    });
});
