# TocToc Auth

A simple authentication library made for backend meatheads.

## Overview

TocToc Auth is a lightweight, secure authentication library for React applications. It provides a straightforward way to implement JWT-based authentication with access and refresh tokens, keeping frontend developers from having to deal with the complexity of authentication flows.

## Features

- JWT-based authentication with access and refresh tokens
- Automatic token refresh with retry logic and exponential backoff
- Encrypted local storage for secure token storage
- Axios interceptors for authenticated API requests
- User authentication state management
- Protected routes with redirection
- Role-based component protection
- Customizable authentication endpoints and response formats
- Context-based configuration (SSR compatible)

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

> **Important:**
> This is a client-side protection mechanism, so you should also implement server-side authorization to ensure specific permissions.

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
import axios from "axios";
import {
  createTocTocAxiosWrapper,
  useTocTocConfig,
  useTocTocAuth,
} from "toctoc-auth";

const ApiService = () => {
  const config = useTocTocConfig();
  const { getUser } = useTocTocAuth();

  const api = axios.create({
    baseURL: import.meta.env.VITE_API_BASE_URL,
  });

  const getAuthContent = () => {
    // Access current auth content from your app state
    return localStorageService.getItem("toctoc-auth", config.encryptionKey);
  };

  const authenticatedApi = createTocTocAxiosWrapper(
    config,
    api,
    getAuthContent
  );

  const fetchData = async () => {
    const response = await authenticatedApi.get("/protected-resource");
    return response.data;
  };

  return { fetchData };
};
```

- The wrapper will automatically attach the access token to requests and handle token refresh on 401 errors. If the refresh fails, the user will be signed out and redirected.

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

#### useTocTocConfig()

Access the current authentication configuration within components:

```tsx
import { useTocTocConfig } from "toctoc-auth";

const MyComponent = () => {
  const config = useTocTocConfig();
  console.log(config.apiBaseUrl); // Access configuration
};
```

### Functions

#### createTocTocAxiosWrapper(config, api, getAuthContent)

Creates an authenticated Axios instance with automatic token handling:

- `config: TocTocAuthConfig` — Authentication configuration
- `api: AxiosInstance` — Axios instance to wrap
- `getAuthContent: () => TocTocAuthContent | null` — Function to get current auth state

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
| `signInResponseJsonAccessTokenLocation`  | string[] | Path to access token in API response                                    |
| `signInResponseJsonRefreshTokenLocation` | string[] | Path to refresh token in API response                                   |
| `signInResponseJsonUserLocation`         | string[] | Path to user data in API response (optional)                            |

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

## Security Considerations

- Use a strong `encryptionKey` to protect stored tokens
- Always use HTTPS for API communications
- Implement proper token expiration on the backend
- Use proper CORS settings on your API
- Refresh tokens are sent securely in request body
- Configure retry options based on your network requirements
- Use React context for SSR-compatible configuration management

## License

MIT
