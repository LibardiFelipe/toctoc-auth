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

const App = () => {
  const authConfig = {
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

  return (
    <TocTocAuthProvider config={authConfig}>
      <YourApp />
    </TocTocAuthProvider>
  );
};
```

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
  return (
    <TocToc redirectTo="/login" loadingScreen={<div>Loading...</div>}>
      {children}
    </TocToc>
  );
};
```

For public routes that should redirect authenticated users:

```tsx
const PublicRoute = ({ children }) => {
  return (
    <TocToc
      reverse={true}
      redirectTo="/dashboard"
      loadingScreen={<div>Loading...</div>}
    >
      {children}
    </TocToc>
  );
};
```

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

const api = axios.create({
  baseURL: "https://api.example.com",
});

const authenticatedApi = withTocTocAxiosWrapper(api);

const fetchData = async () => {
  const response = await authenticatedApi.get("/protected-resource");
  return response.data;
};
```

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

## Security Considerations

- Use a strong `encryptionKey` to protect stored tokens
- Always use HTTPS for API communications
- Implement proper token expiration on the backend
- Use proper CORS settings on your API

## License

MIT
