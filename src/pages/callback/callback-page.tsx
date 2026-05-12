import React, { useEffect, useState } from 'react';
import Cookies from 'js-cookie';
import { crypto_currencies_display_order, fiat_currencies_display_order } from '@/components/shared';
import { generateDerivApiInstance } from '@/external/bot-skeleton/services/api/appId';
import { observer as globalObserver } from '@/external/bot-skeleton/utils/observer';
import { clearAuthData } from '@/utils/auth-utils';
import { Callback } from '@deriv-com/auth-client';
import { Button } from '@deriv-com/ui';
import { PKCE_VERIFIER_KEY, PKCE_STATE_KEY } from '@/utils/pkce';

const getSelectedCurrency = (
    tokens: Record<string, string>,
    clientAccounts: Record<string, any>,
    state: any
): string => {
    const getQueryParams = new URLSearchParams(window.location.search);
    const currency =
        (state && state?.account) ||
        getQueryParams.get('account') ||
        sessionStorage.getItem('query_param_currency') ||
        '';
    const firstAccountKey = tokens.acct1;
    const firstAccountCurrency = clientAccounts[firstAccountKey]?.currency;

    const validCurrencies = [...fiat_currencies_display_order, ...crypto_currencies_display_order];
    if (tokens.acct1?.startsWith('VR') || currency === 'demo') return 'demo';
    if (currency && validCurrencies.includes(currency.toUpperCase())) return currency;
    return firstAccountCurrency || 'USD';
};

/* ─────────────────────────────────────────────────────────
   PKCE callback — handles ?code=... redirects from Deriv.
   Sends code + verifier to the backend for secure token
   exchange, then stores legacy tokens and redirects home.
───────────────────────────────────────────────────────── */
const PkceCallbackHandler = () => {
    const [status, setStatus] = useState<'processing' | 'error'>('processing');
    const [errorMsg, setErrorMsg] = useState('');

    useEffect(() => {
        const run = async () => {
            try {
                const params = new URLSearchParams(window.location.search);

                // Surface Deriv-side errors immediately
                const derivError = params.get('error');
                if (derivError) {
                    const desc = params.get('error_description') ?? derivError;
                    if (derivError === 'redirect_uri_mismatch' || derivError === 'invalid_client') {
                        throw new Error(`Configuration error: ${desc}. Please contact support.`);
                    }
                    throw new Error(`Deriv login error: ${desc}`);
                }

                const code          = params.get('code');
                const returnedState = params.get('state');
                const storedState   = localStorage.getItem(PKCE_STATE_KEY);
                const verifier      = localStorage.getItem(PKCE_VERIFIER_KEY);

                if (!code)     throw new Error('No authorization code found in URL. Please try logging in again.');
                if (!verifier) throw new Error('PKCE verifier missing. Please try logging in again.');
                if (storedState && returnedState && storedState !== returnedState) {
                    throw new Error('State mismatch — possible CSRF attack. Please try logging in again.');
                }

                const redirectUri = `${window.location.origin}/callback`;

                // ── Step 1: Backend exchanges code for access_token (sets httpOnly cookie) ──
                const tokenRes = await fetch('/api/auth/token', {
                    method: 'POST',
                    credentials: 'include',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ code, codeVerifier: verifier, redirectUri }),
                });

                const tokenBody = await tokenRes.json() as { success?: boolean; error?: string; description?: string };

                if (!tokenRes.ok) {
                    const detail = tokenBody.description ?? tokenBody.error ?? `HTTP ${tokenRes.status}`;
                    if (tokenBody.error === 'invalid_grant') {
                        // Code expired or verifier wrong — user should restart login
                        throw new Error('Login code expired or already used. Redirecting you to log in again…');
                    }
                    throw new Error(`Token exchange failed: ${detail}`);
                }

                // Clean up PKCE state
                localStorage.removeItem(PKCE_VERIFIER_KEY);
                localStorage.removeItem(PKCE_STATE_KEY);

                // ── Step 2: Fetch legacy Deriv tokens using the access_token (via cookie) ──
                const legacyRes = await fetch('/api/trading/v1/legacy/tokens', {
                    credentials: 'include',
                });

                if (legacyRes.ok) {
                    // Legacy tokens available — populate accountsList
                    const legacyData = await legacyRes.json() as Record<string, string>;
                    const tokens: Record<string, string> = legacyData.tokens ?? legacyData;

                    const accountsList: Record<string, string> = {};
                    const clientAccounts: Record<string, { loginid: string; token: string; currency: string }> = {};

                    for (const [key, value] of Object.entries(tokens)) {
                        if (key.startsWith('acct')) {
                            const tokenKey = key.replace('acct', 'token');
                            if (tokens[tokenKey]) {
                                accountsList[value] = tokens[tokenKey];
                                clientAccounts[value] = { loginid: value, token: tokens[tokenKey], currency: '' };
                            }
                        } else if (key.startsWith('cur')) {
                            const accKey = key.replace('cur', 'acct');
                            if (tokens[accKey] && clientAccounts[tokens[accKey]]) {
                                clientAccounts[tokens[accKey]].currency = value;
                            }
                        }
                    }

                    localStorage.setItem('accountsList', JSON.stringify(accountsList));
                    localStorage.setItem('clientAccounts', JSON.stringify(clientAccounts));
                    if (tokens.token1) localStorage.setItem('authToken', tokens.token1);
                    if (tokens.acct1)  localStorage.setItem('active_loginid', tokens.acct1);
                } else {
                    // Legacy endpoint failed — mark as authenticated and continue
                    // The app will detect the httpOnly cookie via /api/auth/status
                }

                Cookies.set('logged_state', 'true', {
                    domain: window.location.hostname,
                    expires: 30,
                    path: '/',
                    secure: window.location.protocol === 'https:',
                });

                await new Promise(resolve => setTimeout(resolve, 100));
                window.location.replace(`${window.location.origin}/`);
            } catch (e: any) {
                const msg = e?.message ?? 'An unexpected error occurred.';

                // Auto-retry for invalid_grant (expired code)
                if (msg.includes('expired or already used')) {
                    setTimeout(() => { window.location.href = '/'; }, 3000);
                }

                setErrorMsg(msg);
                setStatus('error');
            }
        };

        run();
    }, []);

    if (status === 'error') {
        return (
            <div style={{ padding: '40px', textAlign: 'center', maxWidth: '480px', margin: '0 auto' }}>
                <h2 style={{ color: '#e74c3c', marginBottom: '16px' }}>Login failed</h2>
                <p style={{ color: '#ccc', margin: '16px 0', whiteSpace: 'pre-wrap', textAlign: 'left', background: '#1a1a1a', padding: '12px', borderRadius: '8px', fontSize: '13px' }}>
                    {errorMsg}
                </p>
                <Button onClick={() => { window.location.href = '/'; }}>Return to App</Button>
            </div>
        );
    }

    return (
        <div style={{ padding: '40px', textAlign: 'center' }}>
            <p>Completing login, please wait…</p>
        </div>
    );
};

/* ─────────────────────────────────────────────────────────
   Legacy callback — handles existing Deriv OAuth redirects.
───────────────────────────────────────────────────────── */
const CallbackPage = () => {
    const isPkceFlow = new URLSearchParams(window.location.search).has('code') ||
                       new URLSearchParams(window.location.search).has('error');

    if (isPkceFlow) {
        return <PkceCallbackHandler />;
    }

    return (
        <Callback
            onSignInSuccess={async (tokens: Record<string, string>, rawState: unknown) => {
                const state = rawState as { account?: string } | null;
                const accountsList: Record<string, string> = {};
                const clientAccounts: Record<string, { loginid: string; token: string; currency: string }> = {};

                for (const [key, value] of Object.entries(tokens)) {
                    if (key.startsWith('acct')) {
                        const tokenKey = key.replace('acct', 'token');
                        if (tokens[tokenKey]) {
                            accountsList[value] = tokens[tokenKey];
                            clientAccounts[value] = {
                                loginid: value,
                                token: tokens[tokenKey],
                                currency: '',
                            };
                        }
                    } else if (key.startsWith('cur')) {
                        const accKey = key.replace('cur', 'acct');
                        if (tokens[accKey]) {
                            clientAccounts[tokens[accKey]].currency = value;
                        }
                    }
                }

                localStorage.setItem('accountsList', JSON.stringify(accountsList));
                localStorage.setItem('clientAccounts', JSON.stringify(clientAccounts));

                let is_token_set = false;
                const api = await generateDerivApiInstance();
                if (api) {
                    const { authorize, error } = await api.authorize(tokens.token1);
                    api.disconnect();
                    if (error) {
                        if (error.code === 'InvalidToken') {
                            is_token_set = true;
                            const is_tmb_enabled = window.is_tmb_enabled === true;
                            if (Cookies.get('logged_state') === 'true' && !is_tmb_enabled) {
                                globalObserver.emit('InvalidToken', { error });
                            }
                            if (Cookies.get('logged_state') === 'false') {
                                clearAuthData();
                            }
                        }
                    } else {
                        localStorage.setItem('callback_token', authorize.toString());
                        const clientAccountsArray = Object.values(clientAccounts);
                        const firstId = authorize?.account_list[0]?.loginid;
                        const filteredTokens = clientAccountsArray.filter(account => account.loginid === firstId);
                        if (filteredTokens.length) {
                            localStorage.setItem('authToken', filteredTokens[0].token);
                            localStorage.setItem('active_loginid', filteredTokens[0].loginid);
                            is_token_set = true;
                        }
                    }
                }
                if (!is_token_set) {
                    localStorage.setItem('authToken', tokens.token1);
                    localStorage.setItem('active_loginid', tokens.acct1);
                }

                Cookies.set('logged_state', 'true', {
                    domain: window.location.hostname,
                    expires: 30,
                    path: '/',
                    secure: window.location.protocol === 'https:',
                });

                const selected_currency = getSelectedCurrency(tokens, clientAccounts, state);
                await new Promise(resolve => setTimeout(resolve, 100));
                window.location.replace(window.location.origin + `/?account=${selected_currency}`);
            }}
            renderReturnButton={() => {
                return (
                    <Button
                        className='callback-return-button'
                        onClick={() => { window.location.href = '/'; }}
                    >
                        {'Return to Bot'}
                    </Button>
                );
            }}
        />
    );
};

export default CallbackPage;
