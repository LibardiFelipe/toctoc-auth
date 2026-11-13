# TocToc Auth

A simple authentication library made for backend meatheads.

## Overview

TocToc Auth is an authentication library for React applications. It provides JWT-based authentication with access and refresh tokens.

## Features

- JWT-based authentication with access and refresh tokens
- Automatic token refresh and configurable retry logic for login
- Refresh token coordination across wrapper instances and same-origin tabs using Web Locks
- Client-side localStorage encryption with AES-256-CBC and PBKDF2-derived encryption and authentication keys
- A local browser environment marker checked on uncached storage reads
- Client-side JWT expiration checking via `isTokenExpired` utility
- Open redirect protection on all auth redirects
- Input sanitization with prototype pollution prevention
- Environment-aware logging (suppressed in production)
- Axios interceptors for authenticated API requests
- User authentication state management
- Protected routes with redirection
- Role-based component protection with optional content hiding
- Customizable authentication endpoints and response formats
- Context-based configuration (SSR compatible)
- Built-in retry mechanism for network requests with configurable options

## Installation

```bash
npm install toctoc-auth
```

or

```bash
yarn add toctoc-auth
```

## Getting Started

### 1. Configure the Authentication Provider

Wrap your application with the `TocTocAuthProvider` and provide your configuration:

```tsx
import { TocTocAuthProvider } from "toctoc-auth";

export const authConfig = {
  apiBaseUrl: "https://api.example.com",
  encryptionKey: "your-client-side-encryption-key",
  retryOptions: {
    maxRetries: 3,
    baseDelay: 1000,
    maxDelay: 5000,
  },
  providers: {
    credentials: {
      signUpApiRoute: "/auth/register",
      signInApiRoute: "/auth/login",
      refreshTokenApiRoute: "/auth/refresh",
      signInAfterSignUp: true,
      redirectClientRoutes: {
        afterSignUp: "/complete-profile",
        afterSignIn: "/dashboard",
        afterSignOut: "/login",
      },
      signInJsonResponseAccessTokenLocation: ["accessToken"],
      signInJsonResponseRefreshTokenLocation: ["refreshToken"],
      signInJsonResponseUser: {
        location: ["user"],
        roleLocation: ["role"], // path to the role relative to the user object
      },
    },
  },
};

const App = () => {
  return (
    <TocTocAuthProvider config={authConfig}>
      <YourApp />
    </TocTocAuthProvider>
  );
};
```

> **Important:**
> If you set `signInAfterSignUp: true`, the data sent to the signUp endpoint will be reused for the signIn endpoint immediately after registration. Therefore, your signIn endpoint must accept the same properties as your signUp endpoint (e.g., if you register with `email` and `password`, your login must also accept `email` and `password`).

### 2. Use Authentication Hooks in Your Components

```tsx
import { useTocTocAuth } from "toctoc-auth";

const LoginForm = () => {
  const { signInWithCredentialsAsync, isAuthenticating } = useTocTocAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    const data = {
      email: "user@example.com",
      password: "password123",
    };

    try {
      const response = await signInWithCredentialsAsync(data);
      if (response.isSuccess) {
        console.log("Logged in successfully!");
      } else {
        console.error("Login failed:", response.responseBody);
      }
    } catch (error) {
      console.error("Error during login:", error);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* ...form fields */}
      <button type="submit" disabled={isAuthenticating}>
        {isAuthenticating ? "Signing in..." : "Sign in"}
      </button>
    </form>
  );
};
```

### 3. Protect Routes

TocToc provides a component to protect routes based on authentication status:

```tsx
import { TocTocRedirect } from "toctoc-auth";

const PrivateRoute = ({ children }) => {
  return <TocTocRedirect to="/login">{children}</TocTocRedirect>;
};
```

For public routes that should redirect authenticated users:

```tsx
const PublicRoute = ({ children }) => {
  return (
    <TocTocRedirect reverse={true} to="/dashboard">
      {children}
    </TocTocRedirect>
  );
};
```

> **Important:**
> This is a client-side protection mechanism, so you should also implement server-side authentication/authorization to ensure the security of your application.

### 4. Protect Components

TocToc also provides a component to "protect" and blur other components based on the user role:

```tsx
import { TocTocGuard } from "toctoc-auth";

const App = () => {
  return (
    <TocTocGuard<EUserRole>
      allowedRoles={["Moderator", "Admin"]}
      lockIcon={<LockOutlined />}
    >
      <MyProtectedComponent />
    </TocTocGuard>
  );
};
```

- `allowedRoles`: An array of allowed roles.
- `lockIcon`: A component that will be used as a protection icon if user role is not allowed.
- `hideContent`: When `true`, protected content is not rendered in the DOM at all (default: `false`, which blurs the content).
- `blurRadius`: Blur intensity in pixels when `hideContent` is `false` (default: `3`).
- `style`: Custom styles for the wrapper element.

> **Important:**
> This is a **UX feature, not a security control**. Always enforce authorization server-side. This component only hides UI elements and should not protect sensitive data.

### 5. Access User Information

```tsx
import { useTocTocAuth } from "toctoc-auth";

const Profile = () => {
  const { getUser } = useTocTocAuth();
  const user = getUser<{ name: string; email: string }>();

  return (
    <div>
      <h1>Welcome, {user?.name}</h1>
      <p>Email: {user?.email}</p>
    </div>
  );
};
```

### 6. Add Authentication to API Requests

TocToc provides an Axios wrapper that automatically adds authentication headers and handles token refresh:

```tsx
import { createTocTocAxiosWrapper } from "toctoc-auth";
import { authConfig } from "../../configs";

export const api = createTocTocAxiosWrapper(
  authConfig,
  axios.create({
    baseURL: import.meta.env.VITE_API_BASE_URL,
    headers: {
      "Content-Type": "application/json",
    },
  })
);

await api.get("/some-protected-route");
```

- The wrapper attaches the access token only when the resolved request URL has the same HTTP(S) origin (scheme, host, and port) as `apiBaseUrl`. Set the Axios `baseURL` accordingly; relative URLs must be resolvable against the document's base URL.
- Existing `Authorization` headers, including Axios defaults, are left untouched. Only requests authenticated by the wrapper trigger token refresh on a 401 response.
- Coordinates refreshes across wrapper instances and same-origin tabs using Web Locks
- If the refresh fails, the user will be signed out and redirected

## API Reference

### Hooks

#### useTocTocAuth()

The authentication context provides the following properties and methods:

- `isAuthenticated: boolean` — Whether the user is currently authenticated.
- `isAuthenticating: boolean` — Whether an authentication operation is in progress.
- `signUpWithCredentialsAsync(data): Promise<TocTocResult>` — Register a new user.
- `signInWithCredentialsAsync(data): Promise<TocTocResult>` — Sign in with credentials.
- `signOutAsync(): Promise<void>` — Sign out the current user.
- `getUser<TUser>(): TUser | undefined` — Get the current user object (type-safe).

The provider updates authentication and user state after library-managed session writes,
including token refresh, and when another tab changes or clears local storage. Direct
localStorage writes in the same tab do not notify the provider.

For JWT-shaped access tokens, `isAuthenticated` is false when the `exp` claim is
missing, invalid, or expired, and changes when the token expires. Opaque tokens are
treated as authenticated while present because their expiration cannot be read.
The stored session and `getUser()` remain available after expiration. The provider
does not refresh on startup: a wrapped request can still send the stored token and
refresh it after a 401, subject to the Web Locks requirements below. Applications
that block all requests while unauthenticated must initiate that request themselves
or ask the user to sign in again.

### Functions

#### createTocTocAxiosWrapper(config, api)

Creates an authenticated Axios instance with automatic token handling:

- `config: TocTocAuthConfig` — Authentication configuration
- `api: AxiosInstance` — Axios instance to wrap

Features:

- Automatically attaches access tokens to requests
- Handles token refresh on 401 responses with deduplication
- Clears session and redirects on refresh failure

#### isTokenExpired(token)

Checks if a JWT token has expired by decoding its payload and comparing the `exp` claim to the current time:

- `token: string` — The JWT token to check
- Returns `true` if the token is expired or invalid, `false` otherwise
- Decodes the payload only; it does not verify the JWT signature or establish authorization.

```tsx
import { isTokenExpired } from "toctoc-auth";

if (isTokenExpired(myToken)) {
  // Token is expired, handle accordingly
}
```

## Configuration Options

### TocTocAuthConfig

| Property                | Type   | Description                                             |
| ----------------------- | ------ | ------------------------------------------------------- |
| `apiBaseUrl`            | string | Base URL for API requests                               |
| `encryptionKey`         | string | Client-accessible passphrase used to encrypt authentication data in localStorage; not a secret from page scripts |
| `retryOptions`          | object | Optional retry configuration for login requests         |
| `providers.credentials` | object | Configuration for username/password authentication      |

### Retry Options

| Property     | Type   | Default | Description                      |
| ------------ | ------ | ------- | -------------------------------- |
| `maxRetries` | number | 3       | Maximum number of retry attempts |
| `baseDelay`  | number | 1000    | Base delay in milliseconds       |
| `maxDelay`   | number | 5000    | Maximum delay in milliseconds    |

### Credentials Provider Configuration

| Property                                 | Type     | Description                                                             |
| ---------------------------------------- | -------- | ----------------------------------------------------------------------- |
| `signUpApiRoute`                         | string   | API endpoint for user registration                                      |
| `signInApiRoute`                         | string   | API endpoint for user login                                             |
| `refreshTokenApiRoute`                   | string   | API endpoint for token refresh (receives refresh token in request body) |
| `signInAfterSignUp`                      | boolean  | Whether to automatically sign in after registration                     |
| `redirectClientRoutes`                   | object   | Routes for redirection after auth actions                               |
| `signInJsonResponseAccessTokenLocation`  | string[] | Path to access token in API response                                    |
| `signInJsonResponseRefreshTokenLocation` | string[] | Path to refresh token in API response                                   |
| `signInJsonResponseUser.location`        | string[] | Path to user data in API response (optional)                            |
| `signInJsonResponseUser.roleLocation`    | string[] | Path to the role relative to the user object                            |

> **Note:**
> If `signInAfterSignUp` is `true`, the same data sent to `signUpApiRoute` will be sent to `signInApiRoute` after registration. Make sure both endpoints accept the same payload structure.

## Backend API Requirements

### Refresh Token Endpoint

Your refresh token endpoint must accept the refresh token in the request body:

```
POST /auth/refresh
Content-Type: application/json

{
  "refreshToken": "your-refresh-token-here"
}
```

The endpoint should return the same response format as your login endpoint, containing new access and refresh tokens.

## Advanced Features

### Retry Mechanism

TocToc Auth retries login requests with the following policy:

- **Exponential backoff**: Delays increase exponentially between retry attempts
- **Jitter**: Random variance added to prevent thundering herd problems
- **Configurable options**: Customize max retries, base delay, and max delay. `maxRetries` counts additional attempts; set it to 0 to disable retries.
- **Retry conditions**: Login retries on network errors and HTTP status codes 408, 429, 500, 502, 503, and 504. Other HTTP responses are handled immediately. After the final attempt, a JSON response body is returned in the result or the final network error is thrown.

Login retries can issue multiple requests when a response is lost. The login endpoint
must tolerate repeated submissions, including any session-creation side effects; set
`maxRetries` to 0 if it cannot. Registration and refresh are never retried automatically,
even on these HTTP statuses or network errors: the server may have created an account or
rotated a refresh token before the response was lost. Applications should resolve an
uncertain registration outcome with the backend before submitting it again.

Example retry configuration:

```tsx
const authConfig = {
  // ... other config
  retryOptions: {
    maxRetries: 5,
    baseDelay: 2000,
    maxDelay: 10000,
  },
};
```

### Refresh Token Deduplication

The wrapper uses the browser's Web Locks API to serialize refresh operations across wrapper instances and tabs that share the same origin and storage. After acquiring the lock it reads the session again: if another request already rotated the tokens, it retries with the current access token instead of refreshing again. Login and logout storage changes use the same lock, so they can wait for an in-flight refresh to finish.

Web Locks requires a supported browser and a secure context (HTTPS or localhost). If unavailable, ordinary requests, login and logout still work, but automatic refresh is disabled: a 401 is returned to the caller and the session is not cleared. Applications must handle that response. Existing sessions without a session identifier are upgraded when first used; simultaneous requests during that one-time upgrade may be canceled and can be retried. Cross-origin pages, separate browser profiles, and older library versions do not share this coordination.

To run the two-tab integration test, install Playwright's Chromium (`npx playwright install chromium`) and run `npm run test:browser`. Alternatively, set `TEST_CHROMIUM_PATH` to an existing Chromium executable.

## Security

### Storage and session security

The credentials flow receives access and refresh tokens in JSON and stores them in `localStorage`. The versioned record uses AES-256-CBC and an HMAC over the version, salt, IV and ciphertext, with separate keys derived from the passphrase using PBKDF2-SHA256 (100,000 iterations). Client-side code must have access to the configured passphrase and decrypted tokens: encryption does not protect them from malicious page scripts, including scripts running through XSS. A passphrase included in frontend code or configuration must not be treated as a secret.

**Upgrade:** Sessions stored by earlier versions use a format whose IV was not authenticated. They cannot be safely verified or migrated, so the library removes those records on first read and users must sign in again. New sign-ins use the authenticated format. Older versions cannot read the new format; avoid deploying mixed versions against the same storage.

The stored record also contains a marker derived from browser properties. On an uncached read, a mismatch causes the local record to be removed. Browser properties can change, and the marker can be copied or imitated. This check neither proves token theft nor binds tokens to a browser on the server; a stolen bearer token can be replayed independently of it.

For applications that need to keep session credentials out of JavaScript, consider a server-managed session using `HttpOnly`, `Secure` cookies with an appropriate `SameSite` policy. `HttpOnly` prevents scripts from reading the cookie value, but XSS can still perform authenticated actions. Because browsers send cookies automatically, use appropriate CSRF protections, such as CSRF tokens and origin validation, and configure cookie scope and cross-origin credentials deliberately. This requires a compatible backend and authentication flow. TocToc's current credentials flow requires tokens in JSON, stores them in JavaScript-accessible storage, and sends the refresh token in the request body; it does not implement an HttpOnly-cookie session flow.

### Other protections

- **Open redirect prevention** on all authentication redirects (blocks `javascript:`, `data:`, protocol-relative URLs, and external origins)
- **Input sanitization** with prototype pollution prevention (`__proto__`, `constructor`, `prototype` keys are blocked)
- **Environment-aware logging** — console output is suppressed in production to prevent information leakage
- **Refresh session checks** and an origin-wide lock prevent an in-flight refresh from replacing a session changed through this library's login or logout.

### Recommended Server-Side Headers

For applications using this library, configure the following HTTP security headers:

```
Strict-Transport-Security: max-age=31536000; includeSubDomains
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Content-Security-Policy: default-src 'self'
Referrer-Policy: strict-origin-when-cross-origin
```

### Best Practices

- Treat `encryptionKey` as client-accessible configuration, not as protection against page scripts
- Always use HTTPS for API communications
- Implement proper token expiration and rate limiting on the backend
- Use proper CORS settings on your API
- `TocTocGuard` is a UX feature — always enforce authorization server-side
- `TocTocRedirect` is a client-side redirect — always validate authentication server-side

## License

MIT
