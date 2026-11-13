import { CanceledError, type AxiosInstance, type InternalAxiosRequestConfig } from "axios";
import { credentialsService, localStorageService } from ".";
import { utils, logger } from "../libs";
import { type TocTocAuthConfig, type TocTocAuthContent } from "../types";
import { TOCTOC_AUTH_CACHE_KEY } from "../providers/toctoc-provider";
import { createSessionId, hasSessionLock, withSessionLock } from "./refresh-manager";
import { advanceSessionGeneration, getSessionGeneration } from "./session-generation";

type SessionSnapshot = {
  generation: number;
  sessionId: string | undefined;
  accessToken: string;
  refreshToken: string;
};
type RetryConfig = InternalAxiosRequestConfig & { __tocTocRetrySession?: SessionSnapshot };

export const createTocTocAxiosWrapper = (tocTocConfig: TocTocAuthConfig, api: AxiosInstance): AxiosInstance => {
  const authenticatedRequests = new WeakMap<InternalAxiosRequestConfig, SessionSnapshot>();
  const signOutRedirectRoute = tocTocConfig.providers.credentials?.redirectClientRoutes.afterSignOut;
  const getAuthContent = () => localStorageService.getItem<TocTocAuthContent>(TOCTOC_AUTH_CACHE_KEY, tocTocConfig.encryptionKey);
  const save = (content: TocTocAuthContent) => localStorageService.setItem(TOCTOC_AUTH_CACHE_KEY, content, tocTocConfig.encryptionKey);
  const snapshotOf = (content: TocTocAuthContent): SessionSnapshot => ({
    generation: getSessionGeneration(), sessionId: content.sessionId,
    accessToken: content.accessToken, refreshToken: content.refreshToken,
  });
  const sameSession = (snapshot: SessionSnapshot, current: TocTocAuthContent | null): current is TocTocAuthContent =>
    snapshot.generation === getSessionGeneration() && !!snapshot.sessionId && current?.sessionId === snapshot.sessionId;
  const exactSession = (snapshot: SessionSnapshot, current: TocTocAuthContent | null) =>
    sameSession(snapshot, current) && current.accessToken === snapshot.accessToken && current.refreshToken === snapshot.refreshToken;

  const isTrustedRequest = (config: InternalAxiosRequestConfig): boolean => {
    try {
      const base = typeof document === "undefined" ? undefined : document.baseURI;
      const trusted = new URL(tocTocConfig.apiBaseUrl, base);
      const target = new URL(api.getUri(config), base);
      return (trusted.protocol === "https:" || trusted.protocol === "http:") && target.origin === trusted.origin;
    } catch { return false; }
  };

  api.interceptors.request.use(async config => {
    const retrySession = (config as RetryConfig).__tocTocRetrySession;
    if (retrySession && !exactSession(retrySession, getAuthContent())) {
      throw new CanceledError("Session changed before the request could be retried");
    }
    if (!isTrustedRequest(config) || config.headers.has("Authorization")) return config;

    let content = getAuthContent();
    // Upgrade existing sessions under the same lock used by refresh/login/logout.
    if (content?.accessToken && !content.sessionId && hasSessionLock()) {
      const previous = content;
      const generation = getSessionGeneration();
      content = await withSessionLock(() => {
        if (generation !== getSessionGeneration()) return null;
        const current = getAuthContent();
        if (!current?.accessToken || current.sessionId || current.accessToken !== previous.accessToken ||
            current.refreshToken !== previous.refreshToken) return null;
        const upgraded = { ...current, sessionId: createSessionId() };
        save(upgraded);
        return upgraded;
      });
      if (!content || generation !== getSessionGeneration() || !exactSession(snapshotOf(content), getAuthContent())) {
        throw new CanceledError("Session changed before the request could be sent");
      }
    }
    if (content?.accessToken) {
      config.headers.set("Authorization", `Bearer ${content.accessToken}`);
      authenticatedRequests.set(config, snapshotOf(content));
    }
    return config;
  });

  api.interceptors.response.use(response => response, async error => {
    const original = error.config;
    const snapshot = original && authenticatedRequests.get(original);
    if (!original || error.response?.status !== 401 || original._retry || !snapshot ||
        !isTrustedRequest(original) || !hasSessionLock()) return Promise.reject(error);
    original._retry = true;

    let next: TocTocAuthContent | null;
    try {
      next = await withSessionLock(async () => {
        const current = getAuthContent();
        if (!sameSession(snapshot, current)) return null;
        // Another request already rotated the token while this 401 was in flight.
        if (current.accessToken !== snapshot.accessToken || current.refreshToken !== snapshot.refreshToken) return current;
        try {
          if (!current.refreshToken) throw new Error("No refresh token available");
          const response = await credentialsService.refreshTokenAsync(tocTocConfig, current.refreshToken);
          if (!exactSession(snapshot, getAuthContent())) return null;
          if (!response.isSuccess) throw new Error("Failed to refresh token");
          const accessToken = utils.getNestedProperty<string>(response.responseBody,
            tocTocConfig.providers.credentials?.signInJsonResponseAccessTokenLocation ?? ["accessToken"]);
          const refreshToken = utils.getNestedProperty<string>(response.responseBody,
            tocTocConfig.providers.credentials?.signInJsonResponseRefreshTokenLocation ?? ["refreshToken"]);
          if (!accessToken || !refreshToken || typeof accessToken !== "string" || typeof refreshToken !== "string") {
            throw new Error("Refresh response did not contain valid tokens");
          }
          const user = utils.getNestedProperty<object>(response.responseBody,
            tocTocConfig.providers.credentials?.signInJsonResponseUser?.location ?? []);
          const updated = { ...current, accessToken, refreshToken, ...(user ? { user } : {}) };
          save(updated);
          return updated;
        } catch (refreshError) {
          if (exactSession(snapshot, getAuthContent())) {
            logger.error("Error refreshing token:", refreshError);
            advanceSessionGeneration();
            localStorageService.removeItem(TOCTOC_AUTH_CACHE_KEY);
            if (signOutRedirectRoute) window.location.replace(signOutRedirectRoute);
          }
          return null;
        }
      });
    } catch {
      // Lock acquisition failures must not clear an otherwise valid session.
      return Promise.reject(error);
    }
    if (!next || !sameSession(snapshot, getAuthContent())) return Promise.reject(error);
    original.headers.Authorization = `Bearer ${next.accessToken}`;
    (original as RetryConfig).__tocTocRetrySession = { ...snapshot, accessToken: next.accessToken, refreshToken: next.refreshToken };
    return api(original);
  });
  return api;
};
