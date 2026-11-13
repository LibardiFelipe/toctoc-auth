import axios from "axios";
import { createTocTocAxiosWrapper } from "../../src/services/toctoc-wrapper";
import { localStorageService } from "../../src/services/localStorage-service";
import React from "react";
import { createRoot, hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { MemoryRouter, useLocation } from "react-router-dom";
import { TocTocAuthProvider } from "../../src/providers/toctoc-provider";
import { useTocTocAuth } from "../../src/hooks";
import { TocTocRedirect } from "../../src/components/toctoc-redirect";
import { TocTocAuthContext } from "../../src/contexts";

const config = { apiBaseUrl: location.origin, encryptionKey: "test", providers: { credentials: {
  refreshTokenApiRoute: "/refresh", signInJsonResponseAccessTokenLocation: ["accessToken"],
  signInJsonResponseRefreshTokenLocation: ["refreshToken"], signInApiRoute: "/login",
  signInJsonResponseUser: { location: ["user"], roleLocation: ["role"] }, redirectClientRoutes: {},
} } } as any;

export const init = () => localStorageService.setItem("toctoc-auth", {
  provider: "credentials", accessToken: "old-access", refreshToken: "old-refresh", sessionId: "test-session", user: { role: "member" },
}, "test");
export const initToken = (accessToken: string) => localStorageService.setItem("toctoc-auth", {
  provider: "credentials", accessToken, refreshToken: "old-refresh", sessionId: "test-session", user: { role: "member" },
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

const HydrationStatus = () => {
  const value = useTocTocAuth();
  const location = useLocation();
  return React.createElement("div", { id: "hydration-status" }, JSON.stringify({
    hydrating: value.isHydrating, authenticated: value.isAuthenticated,
    user: value.getUser(), path: location.pathname,
  }));
};
const hydrationTree = () => React.createElement(MemoryRouter, { initialEntries: ["/private"] },
  React.createElement(TocTocAuthProvider, { config }, React.createElement(HydrationStatus),
    React.createElement(TocTocRedirect, { to: "/login" }, React.createElement("div", { id: "private" }, "private"))));
const hydrationErrors: string[] = [];
export const errors = () => hydrationErrors;
export const hydrate = () => {
  const node = document.createElement("div");
  node.innerHTML = renderToString(hydrationTree());
  const initial = node.innerHTML;
  document.body.appendChild(node);
  hydrateRoot(node, hydrationTree(), { onRecoverableError: error => hydrationErrors.push(String(error)) });
  return initial;
};

const RedirectScenario = ({ initialPath, to, reverse, authenticated }: { initialPath: string; to: string; reverse: boolean; authenticated: boolean }) => {
  const current = useLocation();
  const value = { isHydrating: false, isAuthenticated: authenticated } as React.ContextType<typeof TocTocAuthContext>;
  return React.createElement(TocTocAuthContext.Provider, { value },
    React.createElement("div", { id: "redirect-status" }, JSON.stringify({ pathname: current.pathname, search: current.search, hash: current.hash })),
    current.pathname === initialPath ? React.createElement(TocTocRedirect, { to, reverse }, "protected") : null);
};
export const mountRedirect = (initial: string, to: string, reverse: boolean, authenticated: boolean) => {
  const node = document.createElement("div");
  document.body.appendChild(node);
  createRoot(node).render(React.createElement(MemoryRouter, { initialEntries: [initial] },
    React.createElement(RedirectScenario, { initialPath: new URL(initial, location.origin).pathname, to, reverse, authenticated })));
};
