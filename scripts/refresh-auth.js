/**
 * Pre-flight access-token refresh for the saved Playwright storage state.
 *
 * Aperion keeps auth in localStorage (no cookies): `aperion_token` lives 15 min,
 * `aperion_refresh_token` lives 24 h. A cold page load validates ONLY the access
 * token, so a raw auth.json goes stale in 15 minutes. This posts the saved refresh
 * token to /api/v1/auth/refresh - the same call the portal's tokenRefresh.ts makes
 * every ~14 min - and swaps the new access token back into auth.json.
 *
 * This is session maintenance, NOT an auth bypass: it cannot create a session and
 * cannot outlive the 24 h refresh-token cap. Opt out with APERION_NO_AUTO_REFRESH=1.
 */
const fs = require('fs');
const path = require('path');

const AUTH_FILE = path.join(__dirname, '..', 'auth', 'auth.json');
const ACCESS_KEY = 'aperion_token';
const REFRESH_KEY = 'aperion_refresh_token';

const STATUS = { OK: 'ok', SKIPPED: 'skipped', STALE: 'stale', MISSING: 'missing' };

function log(quiet, msg) {
  if (!quiet) console.log(msg);
}

async function refreshAuth({ quiet = false } = {}) {
  if (!fs.existsSync(AUTH_FILE)) {
    console.error(
      '\n  No auth/auth.json found.\n' +
      '  Run `npm run auth`, log in by hand (real OTP), then close the browser.\n'
    );
    return STATUS.MISSING;
  }

  if (process.env.APERION_NO_AUTO_REFRESH === '1') {
    log(quiet, '  Auth refresh skipped (APERION_NO_AUTO_REFRESH=1).');
    return STATUS.SKIPPED;
  }

  const state = JSON.parse(fs.readFileSync(AUTH_FILE, 'utf8'));
  const origins = state.origins || [];

  // Pick the origin that actually holds a refresh token.
  const entry = origins.find((o) =>
    (o.localStorage || []).some((i) => i.name === REFRESH_KEY && i.value)
  );

  if (!entry) {
    console.warn('  auth.json holds no refresh token - re-run `npm run auth`.');
    return STATUS.STALE;
  }

  const refreshToken = entry.localStorage.find((i) => i.name === REFRESH_KEY).value;

  let res;
  try {
    res = await fetch(`${entry.origin}/api/v1/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Client-Type': 'web' },
      body: JSON.stringify({ refreshToken }),
    });
  } catch (err) {
    console.warn(`  Refresh request failed (${err.message}) - continuing with the saved token.`);
    return STATUS.STALE;
  }

  if (!res.ok) {
    console.warn(
      `  Refresh rejected (HTTP ${res.status}). The 24 h session cap has probably\n` +
      '  been reached - run `npm run auth` and log in by hand again.'
    );
    return STATUS.STALE;
  }

  const body = await res.json().catch(() => null);
  const newToken = body?.data?.token;

  if (!newToken) {
    console.warn('  Refresh response carried no token - continuing with the saved token.');
    return STATUS.STALE;
  }

  // Only the access token rotates; the refresh token is left as-is.
  const slot = entry.localStorage.find((i) => i.name === ACCESS_KEY);
  if (slot) slot.value = newToken;
  else entry.localStorage.push({ name: ACCESS_KEY, value: newToken });

  fs.writeFileSync(AUTH_FILE, JSON.stringify(state, null, 2));
  log(quiet, `  Access token refreshed for ${entry.origin} (valid ~15 min).`);
  return STATUS.OK;
}

module.exports = { refreshAuth, STATUS };

if (require.main === module) {
  refreshAuth().then((status) => {
    // Only a missing auth.json is fatal - a stale one still lets codegen open
    // so you can log in by hand in the recorder window.
    //
    // Set exitCode instead of calling process.exit(): on Windows, exiting from
    // inside this promise while fetch's keep-alive socket is still closing trips
    // a libuv assertion (UV_HANDLE_CLOSING) and returns 127 even on success,
    // which breaks the `&&` chain in `npm run record` and `npm run excel`.
    process.exitCode = status === STATUS.MISSING ? 1 : 0;
  });
}
