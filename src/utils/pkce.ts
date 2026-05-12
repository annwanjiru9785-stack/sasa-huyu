/*
 * PKCE (Proof Key for Code Exchange) helper for Deriv's new auth system.
 *
 * Flow:
 *   1. Generate code_verifier (random) + code_challenge = BASE64URL(SHA256(verifier))
 *   2. Store verifier + random state in localStorage for CSRF protection
 *   3. Redirect to https://auth.deriv.com/oauth2/auth with all PKCE params
 *   4. On callback (/callback route):
 *      a. Verify returned state matches stored state
 *      b. POST code + code_verifier to backend /api/auth/token
 *      c. Backend exchanges code, sets httpOnly cookie with access_token
 *      d. Redirect to app
 */

export const PKCE_VERIFIER_KEY = 'pkce_verifier';
export const PKCE_STATE_KEY    = 'pkce_state';
export const PKCE_CLIENT_ID    = '337DJLKi2OJ4VsyFSLIt9';

const DERIV_AUTH_URL = 'https://auth.deriv.com/oauth2/auth';

function sha256(plain: string): Promise<ArrayBuffer> {
    return window.crypto.subtle.digest('SHA-256', new TextEncoder().encode(plain));
}

function base64url(buffer: ArrayBuffer): string {
    return btoa(String.fromCharCode(...new Uint8Array(buffer)))
        .replace(/=/g, '')
        .replace(/\+/g, '-')
        .replace(/\//g, '_');
}

async function generatePkce(): Promise<{ verifier: string; challenge: string }> {
    const rand      = window.crypto.getRandomValues(new Uint8Array(32));
    const verifier  = base64url(rand.buffer);
    const challenge = base64url(await sha256(verifier));
    return { verifier, challenge };
}

function randomState(): string {
    const arr = window.crypto.getRandomValues(new Uint8Array(16));
    return Array.from(arr, b => b.toString(16).padStart(2, '0')).join('');
}

function buildAuthorizeUrl(challenge: string, state: string, prompt?: string): string {
    const redirect_uri = `${window.location.origin}/callback`;
    const url = new URL(DERIV_AUTH_URL);
    url.searchParams.set('response_type',         'code');
    url.searchParams.set('client_id',             PKCE_CLIENT_ID);
    url.searchParams.set('redirect_uri',          redirect_uri);
    url.searchParams.set('scope',                 'trade');
    url.searchParams.set('state',                 state);
    url.searchParams.set('code_challenge',        challenge);
    url.searchParams.set('code_challenge_method', 'S256');
    if (prompt) url.searchParams.set('prompt', prompt);
    return url.toString();
}

/** Start OAuth2 PKCE login and redirect to Deriv. */
export async function startLogin(): Promise<void> {
    const { verifier, challenge } = await generatePkce();
    const state = randomState();
    localStorage.setItem(PKCE_VERIFIER_KEY, verifier);
    localStorage.setItem(PKCE_STATE_KEY,    state);
    window.location.assign(buildAuthorizeUrl(challenge, state));
}

/** Start OAuth2 PKCE sign-up flow (opens Deriv registration screen). */
export async function startSignup(): Promise<void> {
    const { verifier, challenge } = await generatePkce();
    const state = randomState();
    localStorage.setItem(PKCE_VERIFIER_KEY, verifier);
    localStorage.setItem(PKCE_STATE_KEY,    state);
    window.location.assign(buildAuthorizeUrl(challenge, state, 'registration'));
}

/** @deprecated Use startLogin() instead. */
export async function redirectToNewAccountsLogin(): Promise<void> {
    return startLogin();
}
