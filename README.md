# TocToc Auth

A simple authentication library made for backend meatheads.

## Overview

TocToc Auth is a lightweight, secure authentication library for React applications. It provides a straightforward way to implement JWT-based authentication with access and refresh tokens, keeping frontend developers from having to deal with the complexity of authentication flows.

## Features

- JWT-based authentication with access and refresh tokens
- Automatic token refresh with retry logic and exponential backoff
- Refresh token deduplication to prevent multiple simultaneous refresh requests
- Encrypted local storage with AES-256-CBC, PBKDF2 key derivation, and HMAC integrity verification
- Browser fingerprinting to detect token theft
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
  encryptionKey: "your-strong-encryption-key",
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
        roleLocation: ["role"], // user's role will be searched at locations + roleLocation (user.role)
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

- The wrapper will automatically attach the access token to requests and handle token refresh on 401 errors
- Includes refresh token deduplication to prevent multiple simultaneous refresh attempts
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

### Functions

#### createTocTocAxiosWrapper(config, api)

Creates an authenticated Axios instance with automatic token handling:

- `config: TocTocAuthConfig` — Authentication configuration
- `api: AxiosInstance` — Axios instance to wrap

Features:

- Automatically attaches access tokens to requests
- Handles token refresh on 401 responses with deduplication
- Implements retry logic with exponential backoff
- Clears session and redirects on refresh failure

#### isTokenExpired(token)

Checks if a JWT token has expired by decoding its payload and comparing the `exp` claim to the current time:

- `token: string` — The JWT token to check
- Returns `true` if the token is expired or invalid, `false` otherwise

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
| `encryptionKey`         | string | Key used to encrypt authentication data in localStorage |
| `retryOptions`          | object | Optional retry configuration for network requests       |
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
| `signInJsonResponseUser.roleLocation`    | string[] | Additional path for user role (appended to user location)               |

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

TocToc Auth includes a built-in retry mechanism for network requests with the following features:

- **Exponential backoff**: Delays increase exponentially between retry attempts
- **Jitter**: Random variance added to prevent thundering herd problems
- **Configurable options**: Customize max retries, base delay, and max delay
- **Smart retry conditions**: Only retries on network errors and specific HTTP status codes (408, 429, 500, 502, 503, 504)

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

The library includes a `RefreshTokenManager` that prevents multiple simultaneous refresh token requests:

- **Single refresh request**: Multiple expired requests share one refresh operation
- **State management**: Tracks refresh status to avoid duplicate calls
- **Automatic cleanup**: Resets state after successful or failed refresh attempts

This feature is automatically enabled and requires no additional configuration.

## Security

### Built-in Protections

- **AES-256-CBC encryption** with PBKDF2 key derivation (100,000 iterations) and HMAC integrity verification for localStorage data
- **Browser fingerprinting** to detect token theft across different environments
- **Open redirect prevention** on all authentication redirects (blocks `javascript:`, `data:`, protocol-relative URLs, and external origins)
- **Input sanitization** with prototype pollution prevention (`__proto__`, `constructor`, `prototype` keys are blocked)
- **Environment-aware logging** — console output is suppressed in production to prevent information leakage
- **Race condition prevention** in token refresh via promise deduplication

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

- Use a strong, unique `encryptionKey` — this is the passphrase for PBKDF2 key derivation
- Always use HTTPS for API communications
- Implement proper token expiration and rate limiting on the backend
- Use proper CORS settings on your API
- `TocTocGuard` is a UX feature — always enforce authorization server-side
- `TocTocRedirect` is a client-side redirect — always validate authentication server-side

## License

MIT
