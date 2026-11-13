import { CanceledError, type AxiosInstance, type InternalAxiosRequestConfig } from "axios";
import { credentialsService, localStorageService } from ".";
import { utils, logger } from "../libs";
import { type TocTocAuthConfig, type TocTocAuthContent } from "../types";
import { TOCTOC_AUTH_CACHE_KEY } from "../providers/toctoc-provider";
import { RefreshTokenManager } from "./refresh-manager";
import { advanceSessionGeneration, getSessionGeneration } from "./session-generation";

type SessionSnapshot = {
  generation: number;
  accessToken: string;
  refreshToken: string;
};
type RetryConfig = InternalAxiosRequestConfig & { __tocTocRetrySession?: SessionSnapshot };

export const createTocTocAxiosWrapper = (
  tocTocConfig: TocTocAuthConfig,
  api: AxiosInstance
): AxiosInstance => {
  const refreshManager = new RefreshTokenManager();
  const authenticatedRequests = new WeakMap<InternalAxiosRequestConfig, SessionSnapshot>();
  const signOutRedirectRoute =
    tocTocConfig.providers.credentials?.redirectClientRoutes.afterSignOut;

  const getAuthContent = () => localStorageService.getItem<TocTocAuthContent>(
    TOCTOC_AUTH_CACHE_KEY,
    tocTocConfig.encryptionKey
  );

  const isCurrentSession = (snapshot: SessionSnapshot): boolean => {
    if (snapshot.generation !== getSessionGeneration()) return false;
    const current = getAuthContent();
    return current?.accessToken === snapshot.accessToken &&
      current?.refreshToken === snapshot.refreshToken;
  };

  const isTrustedRequest = (config: InternalAxiosRequestConfig): boolean => {
    try {
      // Axios resolves relative URLs against the document's base URL in browsers.
      const base = typeof document === "undefined" ? undefined : document.baseURI;
      const trusted = new URL(tocTocConfig.apiBaseUrl, base);
      const target = new URL(api.getUri(config), base);
      return (trusted.protocol === "https:" || trusted.protocol === "http:") &&
        target.origin === trusted.origin;
    } catch {
      // An unresolvable URL must never receive credentials.
      return false;
    }
  };

  api.interceptors.request.use(
    (config: InternalAxiosRequestConfig) => {
      const retrySession = (config as RetryConfig).__tocTocRetrySession;
      if (retrySession && !isCurrentSession(retrySession)) {
        throw new CanceledError("Session changed before the request could be retried", config);
      }
      if (!isTrustedRequest(config) || config.headers.has("Authorization")) {
        return config;
      }

      const authContent = getAuthContent();

      if (authContent?.accessToken) {
        config.headers.set("Authorization", `Bearer ${authContent.accessToken}`);
        authenticatedRequests.set(config, {
          generation: getSessionGeneration(),
          accessToken: authContent.accessToken,
          refreshToken: authContent.refreshToken,
        });
      }

      return config;
    },
    (error) => Promise.reject(error)
  );

  api.interceptors.response.use(
    (response) => response,
    async (error) => {
      const originalRequest = error.config;
      const snapshot = originalRequest && authenticatedRequests.get(originalRequest);

      if (originalRequest && error.response?.status === 401 &&
          !originalRequest._retry && snapshot && isCurrentSession(snapshot) &&
          isTrustedRequest(originalRequest)) {
        originalRequest._retry = true;

        try {
          const authContent = getAuthContent();

          if (authContent?.refreshToken) {
            const response = await refreshManager.refresh(
              tocTocConfig,
              authContent.refreshToken,
              credentialsService.refreshTokenAsync,
              snapshot.generation
            );

            if (!isCurrentSession(snapshot)) return Promise.reject(error);

            if (!response.isSuccess) {
              logger.warn("Failed to refresh token. Clearing session.");
              refreshManager.reset();
              clearAndRedirect(signOutRedirectRoute);
              return Promise.reject(error);
            }

            const accessTokenPath = tocTocConfig.providers.credentials
              ?.signInJsonResponseAccessTokenLocation ?? ["accessToken"];
            const refreshTokenPath = tocTocConfig.providers.credentials
              ?.signInJsonResponseRefreshTokenLocation ?? ["refreshToken"];
            const userPath =
              tocTocConfig.providers.credentials?.signInJsonResponseUser
                ?.location ?? [];

            const newAccessToken = utils.getNestedProperty<string>(
              response.responseBody,
              accessTokenPath
            );
            const newRefreshToken = utils.getNestedProperty<string>(
              response.responseBody,
              refreshTokenPath
            );
            const newUser = utils.getNestedProperty<object>(
              response.responseBody,
              userPath
            );

            const updatedAuthContent: TocTocAuthContent = {
              ...authContent,
              accessToken: newAccessToken!,
              refreshToken: newRefreshToken!,
            };

            if (newUser) {
              updatedAuthContent.user = newUser;
            }

            localStorageService.setItem(
              TOCTOC_AUTH_CACHE_KEY,
              updatedAuthContent,
              tocTocConfig.encryptionKey
            );

            originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
            (originalRequest as RetryConfig).__tocTocRetrySession = {
              generation: snapshot.generation,
              accessToken: newAccessToken!,
              refreshToken: newRefreshToken!,
            };

            return api(originalRequest);
          }

          logger.warn("No refresh token available. Clearing session.");
          clearAndRedirect(signOutRedirectRoute);
        } catch (refreshError) {
          if (!isCurrentSession(snapshot)) return Promise.reject(error);
          logger.error("Error refreshing token:", refreshError);
          refreshManager.reset();
          clearAndRedirect(signOutRedirectRoute);
        }
      }

      return Promise.reject(error);
    }
  );

  return api;
};

const clearAndRedirect = (redirectRoute?: string) => {
  advanceSessionGeneration();
  localStorageService.removeItem(TOCTOC_AUTH_CACHE_KEY);
  if (redirectRoute) {
    window.location.replace(redirectRoute);
  }
};
