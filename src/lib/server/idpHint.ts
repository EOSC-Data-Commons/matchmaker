/**
 * Pre-select the "EGI Check-in" entry on EGI Check-in's login page.
 *
 * Check-in now shows an EOSC-federation chooser ("EGI Check-in - EOSC AAI", D4SCIENCE, eLTER,
 * ENVRI-ID) before its familiar page with Google, GitHub, ORCID and the home-institution search.
 * Keycloak skips that chooser when the authorization request carries `kc_idp_hint=<alias>`. An
 * unknown alias just shows the chooser again, so a stale entry here degrades to today's behaviour.
 *
 * The backend builds the authorization URL and answers `/auth/login` with a redirect to it. The
 * proxy in `server.ts` rewrites that redirect using `withIdpHint`, so neither the backend nor the
 * deployment needs a change. The alias is keyed on the issuer host, which is how dev and prod get
 * different values with nothing to configure. Aliases are listed publicly at
 * `https://<host>/auth/realms/egi/theme-info/identity-providers`.
 */
export const OIDC_IDP_HINT_BY_HOST: Readonly<Record<string, string>> = {
    "aai.egi.eu": "check-in",
    "aai-dev.egi.eu": "id-dev",
};

const AUTHORIZATION_PATH_SUFFIX = "/protocol/openid-connect/auth";

/** True for the login route only (`/auth/login`, with or without a query), never `/auth/logout`. */
export function isLoginPath(originalUrl: string | undefined): boolean {
    return /^\/auth\/login(?:[?#]|$)/.test(originalUrl ?? "");
}

/**
 * Returns `location` with `kc_idp_hint` appended when it is a Check-in authorization URL on a
 * known host, otherwise `undefined`, meaning leave the redirect untouched.
 */
export function withIdpHint(location: string): string | undefined {
    let url: URL;
    try {
        url = new URL(location);
    } catch {
        return undefined;
    }
    const alias = OIDC_IDP_HINT_BY_HOST[url.hostname];
    if (!alias) return undefined;
    if (!url.pathname.endsWith(AUTHORIZATION_PATH_SUFFIX)) return undefined;
    if (url.searchParams.has("kc_idp_hint")) return undefined;
    // Append as a string rather than re-serialising through URL, so the backend's encoding of the
    // other parameters (redirect_uri, scope, PKCE challenge) reaches Check-in byte for byte.
    const separator = location.includes("?") ? "&" : "?";
    return `${location}${separator}kc_idp_hint=${encodeURIComponent(alias)}`;
}
