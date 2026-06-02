# Add token refresh to the API client

## Goal

Auto-refresh access tokens 60 seconds before expiry so callers never see 401s
in the middle of a request.

## Approach

The client tracks `tokenExpiry` from the auth response. On every request, if
`Date.now() > tokenExpiry - 60_000`, it fires a refresh in the background and
retries with the new token.

```js
async function authedFetch(url, opts) {
  if (Date.now() > tokenExpiry - 60_000) {
    await refreshToken();
  }
  return fetch(url, withAuthHeader(opts));
}
```

## Storage

The refresh token lives in localStorage. The access token is held only in
memory.

## Open questions

- What if two requests fire at the same time and both decide to refresh?
- Should the retry budget be bounded per request, or per session?
- How do we surface refresh failures to the caller — throw, or return the
  original 401 response?
