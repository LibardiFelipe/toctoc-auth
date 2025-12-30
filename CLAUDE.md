# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

TocToc Auth is a lightweight JWT-based authentication library for React applications. It provides token management, state persistence with encrypted localStorage, protected routes/components, and automatic token refresh with request deduplication.

## Build Commands

```bash
npm run build    # Build with tsup (outputs CJS, ESM, and .d.ts to dist/)
```

No test suite is currently implemented.

## Architecture

The library follows a Provider + Context + Hooks pattern:

```
src/
├── providers/   # TocTocAuthProvider - manages auth state, token storage, navigation
├── contexts/    # TocTocAuthContext (state) + TocTocConfigContext (config)
├── hooks/       # useTocTocAuth, useTocTocConfig
├── services/    # API calls, encryption, localStorage, Axios wrapper
├── components/  # TocTocRedirect (route protection), TocTocGuard (role-based UI)
├── libs/        # Retry utilities with exponential backoff
├── types/       # TypeScript definitions
└── index.ts     # Public API exports
```

### Key Services

- **credentialsService**: Handles sign-up, sign-in, and token refresh API calls
- **cryptoService**: AES encryption/decryption using CryptoJS
- **localStorageService**: Encrypted persistence wrapper
- **createTocTocAxiosWrapper**: Wraps Axios with auth interceptors and 401 handling
- **RefreshTokenManager**: Deduplicates concurrent token refresh requests

### Public API (src/index.ts)

Only these are exported: `TocTocAuthProvider`, `useTocTocAuth`, `TocTocRedirect`, `TocTocGuard`, `createTocTocAxiosWrapper`, `TocTocAuthConfig` type.

## Key Patterns

### Path-based Property Access
Configuration uses string arrays to locate properties in API responses:
```typescript
signInJsonResponseAccessTokenLocation: ["accessToken"]
signInJsonResponseUser: {
  location: ["user"],
  roleLocation: ["role"]  // resolves to ["user", "role"]
}
```

### Generic Types
Auth methods accept generic types for API response typing:
```typescript
signInWithCredentialsAsync<TApiResponse>(data): Promise<TocTocResult<TApiResponse>>
getUser<TUser>(): TUser | undefined
```

### Result Type
All async operations return `TocTocResult<T>` with `isSuccess` boolean and `responseBody`.

### Error Validation
Services validate API responses at runtime with descriptive errors that include expected property paths and config property names (via `nameOf()` helper).

## Dependencies

- React 19, react-router-dom for routing
- axios for HTTP (wrapper support)
- crypto-js for localStorage encryption
- tsup for bundling
