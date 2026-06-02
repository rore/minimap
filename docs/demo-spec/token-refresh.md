# Token refresh for the API client

Auto-refresh access tokens 60 seconds before expiry so callers never see
401s mid-request. The client tracks `tokenExpiry` from the auth response
and, on every outgoing call, checks whether a refresh is due before it
fires the request.

```js
async function authedFetch(url, opts) {
  if (Date.now() > tokenExpiry - 60_000) {
    await refreshToken();
  }
  return fetch(url, withAuthHeader(opts));
}
```

**Open question.** What if two requests fire at the same time and both decide to refresh?

## Storage

The refresh token lives in an httpOnly, Secure, SameSite=Strict cookie
set by the auth endpoint, so JS never touches it directly. The access
token is held only in memory and is rebuilt on every refresh, so a
stale tab can still re-authenticate as long as the refresh cookie is
valid.

## Failure modes

If a refresh fails we surface the underlying 401 to the caller rather
than retrying — retry policy belongs to the caller, not to the auth
layer. Network errors during refresh are retried once with backoff
before being treated as a hard failure.

## Out of scope

- Multi-tab coordination of the refresh (we accept a small amount of
  duplicate work across tabs).
- Rotating refresh tokens — the auth server hands out long-lived
  refresh tokens for now.
