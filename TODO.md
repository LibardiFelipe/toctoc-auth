# Security and reliability TODOs

Findings from the library review, ordered by severity. Check items off when the fix and its verification are complete.

## High

- 1 [x] Restrict bearer-token injection to explicitly trusted API origins and avoid unexpectedly replacing a caller's authorization header. (`src/services/toctoc-wrapper.ts`)
- 2 [x] Correct the documentation's storage-encryption and browser-fingerprint security claims. Evaluate server-managed HttpOnly, Secure cookies where appropriate; client-side encryption and fingerprinting do not prevent token theft by page scripts or bind tokens server-side. (`README.md`, `src/services/localStorage-service.ts`)
- 3 [x] Authenticate the IV and all relevant encryption metadata, preferably using authenticated encryption or separate encryption and MAC keys. Plan migration of existing stored sessions. (`src/services/crypto-service.ts`)
- 4 [x] Prevent an in-flight refresh from restoring a signed-out session or overwriting a newer login; associate refreshes with a session generation and check it before persisting or retrying. (`src/services/toctoc-wrapper.ts`, `src/providers/toctoc-provider.tsx`)
- 5 [x] Coordinate refreshes across wrapper instances and tabs, and handle delayed 401s using an older access token without unnecessarily refreshing again. Test with rotating refresh tokens. (`src/services/toctoc-wrapper.ts`, `src/services/refresh-manager.ts`)

## Medium

- 1 [x] Fix role lookup in `TocTocGuard` to resolve `roleLocation` relative to the user object returned by `getUser()`. (`src/components/toctoc-guard.tsx`)
- 2 [x] Synchronize provider authentication and user state with refreshes, session clearing, and cross-tab storage changes. (`src/providers/toctoc-provider.tsx`, `src/services/toctoc-wrapper.ts`)
- 3 [ ] Define and implement how expired access tokens affect initial authentication state and refresh. (`src/providers/toctoc-provider.tsx`)
- 4 [ ] Fix `isTokenExpired` to decode Base64URL and UTF-8 correctly and reject missing or invalid `exp` values; document that it does not verify signatures. (`src/libs/token-utils.ts`)
- 5 [ ] Implement documented HTTP-status retries explicitly, and make retries safe for non-idempotent registration and rotating refresh operations. (`src/services/credentials-service.ts`, `src/libs/retry-utils.ts`)
- 6 [ ] Distinguish invalid or revoked refresh tokens from temporary network, server, and storage failures instead of clearing the session for every failure. (`src/services/toctoc-wrapper.ts`)
- 7 [ ] Make provider rendering safe without browser storage, including SSR and blocked storage; define hydration behavior. (`src/providers/toctoc-provider.tsx`, `src/services/localStorage-service.ts`)
- 8 [ ] Preserve encoded redirect values, existing target query parameters, and short query strings when constructing redirects. (`src/libs/url-validator.ts`, `src/components/toctoc-redirect.tsx`)
- 9 [ ] Validate that access and refresh tokens in successful responses are nonempty strings before storing them. (`src/services/credentials-service.ts`)
- 10 [ ] Allow refresh responses to omit user data when the existing user should be retained, or explicitly document and enforce the requirement. (`src/services/credentials-service.ts`)
- 11 [ ] Handle empty and non-JSON responses from authentication endpoints without losing useful status and error information. (`src/services/credentials-service.ts`)
- 12 [ ] Make the storage key configurable or namespaced so independent configurations do not overwrite each other; avoid deleting a record merely because a different key cannot decrypt it. (`src/providers/toctoc-provider.tsx`, `src/services/localStorage-service.ts`)

## Low

- 1 [ ] Use a nullable auth-context default so `useTocTocAuth` throws its intended error outside a provider. (`src/contexts/toctoc-context.tsx`, `src/hooks/use-toctoc.tsx`)
- 2 [ ] Prevent accidental interaction with blurred guard content, or consider hiding it by default; retain the server-side authorization warning. (`src/components/toctoc-guard.tsx`)
- 3 [ ] Define supported input types and fix sanitization of objects in arrays and non-plain objects without silently changing legitimate payloads. (`src/libs/input-validator.ts`)
- 4 [ ] Make the build script cross-platform and add meaningful automated tests for authentication, refresh concurrency, redirects, storage, and error handling. (`package.json`)
- 5 [ ] Measure synchronous PBKDF2 and encryption costs on target devices; consider asynchronous Web Crypto or a different storage design if UI blocking is significant. (`src/services/crypto-service.ts`)
