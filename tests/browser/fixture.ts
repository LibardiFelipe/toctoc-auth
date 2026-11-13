import axios from "axios";
import { createTocTocAxiosWrapper } from "../../src/services/toctoc-wrapper";
import { localStorageService } from "../../src/services/localStorage-service";
import React from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { TocTocAuthProvider } from "../../src/providers/toctoc-provider";
import { useTocTocAuth } from "../../src/hooks";

const config = { apiBaseUrl: location.origin, encryptionKey: "test", providers: { credentials: {
  refreshTokenApiRoute: "/refresh", signInJsonResponseAccessTokenLocation: ["accessToken"],
  signInJsonResponseRefreshTokenLocation: ["refreshToken"], signInApiRoute: "/login",
  signInJsonResponseUser: { location: ["user"], roleLocation: ["role"] }, redirectClientRoutes: {},
} } } as any;

export const init = () => localStorageService.setItem("toctoc-auth", {
  provider: "credentials", accessToken: "old-access", refreshToken: "old-refresh", sessionId: "test-session", user: { role: "member" },
}, "test");
export const call = () => createTocTocAxiosWrapper(config, axios.create({ baseURL: location.origin }))
  .get("/protected").then(response => response.status);
export const session = () => localStorageService.getItem("toctoc-auth", "test");

let auth: ReturnType<typeof useTocTocAuth>;
const Status = () => {
  auth = useTocTocAuth();
  return React.createElement("div", { id: "status" }, JSON.stringify({
    authenticated: auth.isAuthenticated, user: auth.getUser(),
  }));
};
export const mount = () => {
  const node = document.createElement("div");
  document.body.appendChild(node);
  createRoot(node).render(React.createElement(MemoryRouter, null,
    React.createElement(TocTocAuthProvider, { config }, React.createElement(Status))));
};
export const login = () => auth.signInWithCredentialsAsync({});
export const logout = () => auth.signOutAsync();
export const clear = () => localStorage.clear();
