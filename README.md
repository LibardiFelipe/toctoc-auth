# TocToc Auth

A simple authentication library made for backend meatheads.

## Overview

TocToc Auth is a lightweight, secure authentication library for React applications. It provides a straightforward way to implement JWT-based authentication with access and refresh tokens, keeping frontend developers from having to deal with the complexity of authentication flows.

## Features

- JWT-based authentication with access and refresh tokens
- Automatic token refresh
- Encrypted local storage for secure token storage
- Axios interceptors for authenticated API requests
- User authentication state management
- Protected routes with redirection
- Customizable authentication endpoints and response formats

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
  providers: {
    credentials: {
      signUpApiRoute: "/auth/register",
      signInApiRoute: "/auth/login",
      refreshTokenApiRoute: "/auth/refresh/",
      signInAfterSignUp: true,
      redirectClientRoutes: {
        afterSignUp: "/complete-profile",
        afterSignIn: "/dashboard",
        afterSignOut: "/login",
      },
      signInResponseJsonAccessTokenLocation: ["accessToken"],
      signInResponseJsonRefreshTokenLocation: ["refreshToken"],
      signInResponseJsonUserLocation: ["user"],
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

TocToc provides a simple component to protect routes based on authentication status:

```tsx
import { TocToc } from "toctoc-auth";

const PrivateRoute = ({ children }) => {
  return <TocToc redirectTo="/login">{children}</TocToc>;
};
```

For public routes that should redirect authenticated users:

```tsx
const PublicRoute = ({ children }) => {
  return (
    <TocToc reverse={true} redirectTo="/dashboard">
      {children}
    </TocToc>
  );
};
```

- `redirectTo`: Path to redirect if the user is not authenticated (or is authenticated and `reverse` is true).
- `reverse`: If true, redirects authenticated users instead of unauthenticated ones.

### 4. Access User Information

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

### 5. Add Authentication to API Requests

TocToc provides an Axios wrapper that automatically adds authentication headers and handles token refresh:

```tsx
import axios from "axios";
import { withTocTocAxiosWrapper } from "toctoc-auth";
import { authConfig } from "../App";

const api = axios.create({
  baseURL: "https://api.example.com",
});

const authenticatedApi = withTocTocAxiosWrapper(authConfig, api);

const fetchData = async () => {
  const response = await authenticatedApi.get("/protected-resource");
  return response.data;
};
```

- The wrapper will automatically attach the access token to requests and handle token refresh on 401 errors. If the refresh fails, the user will be signed out and redirected.

## Authentication Context API

The authentication context provides the following properties and methods via the `useTocTocAuth` hook:

- `isAuthenticated: boolean` — Whether the user is currently authenticated.
- `isAuthenticating: boolean` — Whether an authentication operation is in progress.
- `signUpWithCredentialsAsync(data): Promise<TocTocResult>` — Register a new user.
- `signInWithCredentialsAsync(data): Promise<TocTocResult>` — Sign in with credentials.
- `signOutAsync(): Promise<void>` — Sign out the current user.
- `getUser<TUser>(): TUser | undefined` — Get the current user object (type-safe).

## Configuration Options

### TocTocAuthProviderConfig

| Property                | Type   | Description                                             |
| ----------------------- | ------ | ------------------------------------------------------- |
| `apiBaseUrl`            | string | Base URL for API requests                               |
| `encryptionKey`         | string | Key used to encrypt authentication data in localStorage |
| `providers.credentials` | object | Configuration for username/password authentication      |

### Credentials Provider Configuration

| Property                                 | Type     | Description                                         |
| ---------------------------------------- | -------- | --------------------------------------------------- |
| `signUpApiRoute`                         | string   | API endpoint for user registration                  |
| `signInApiRoute`                         | string   | API endpoint for user login                         |
| `refreshTokenApiRoute`                   | string   | API endpoint for token refresh                      |
| `signInAfterSignUp`                      | boolean  | Whether to automatically sign in after registration |
| `redirectClientRoutes`                   | object   | Routes for redirection after auth actions           |
| `signInResponseJsonAccessTokenLocation`  | string[] | Path to access token in API response                |
| `signInResponseJsonRefreshTokenLocation` | string[] | Path to refresh token in API response               |
| `signInResponseJsonUserLocation`         | string[] | Path to user data in API response (optional)        |

> **Note:**
> If `signInAfterSignUp` is `true`, the same data sent to `signUpApiRoute` will be sent to `signInApiRoute` after registration. Make sure both endpoints accept the same payload structure.

## Security Considerations

- Use a strong `encryptionKey` to protect stored tokens
- Always use HTTPS for API communications
- Implement proper token expiration on the backend
- Use proper CORS settings on your API

## License

MIT
