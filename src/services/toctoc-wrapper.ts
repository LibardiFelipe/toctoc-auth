import { type AxiosInstance, type InternalAxiosRequestConfig } from "axios";
import { credentialsService, localStorageService } from ".";
import { utils, logger } from "../libs";
import { type TocTocAuthConfig, type TocTocAuthContent } from "../types";
import { TOCTOC_AUTH_CACHE_KEY } from "../providers/toctoc-provider";
import { RefreshTokenManager } from "./refresh-manager";

export const createTocTocAxiosWrapper = (
  tocTocConfig: TocTocAuthConfig,
  api: AxiosInstance
): AxiosInstance => {
  const refreshManager = new RefreshTokenManager();
  const signOutRedirectRoute =
    tocTocConfig.providers.credentials?.redirectClientRoutes.afterSignOut;

  const getAuthContent = () => localStorageService.getItem<TocTocAuthContent>(
    TOCTOC_AUTH_CACHE_KEY,
    tocTocConfig.encryptionKey
  );

  api.interceptors.request.use(
    (config: InternalAxiosRequestConfig) => {
      const authContent = getAuthContent();

      if (authContent?.accessToken) {
        config.headers.Authorization = `Bearer ${authContent.accessToken}`;
      }

      return config;
    },
    (error) => Promise.reject(error)
  );

  api.interceptors.response.use(
    (response) => response,
    async (error) => {
      const originalRequest = error.config;

      if (error.response?.status === 401 && !originalRequest._retry) {
        originalRequest._retry = true;

        try {
          const authContent = getAuthContent();

          if (authContent?.refreshToken) {
            const response = await refreshManager.refresh(
              tocTocConfig,
              authContent.refreshToken,
              credentialsService.refreshTokenAsync
            );

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

            return api(originalRequest);
          }

          logger.warn("No refresh token available. Clearing session.");
          clearAndRedirect(signOutRedirectRoute);
        } catch (refreshError) {
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
  localStorageService.removeItem(TOCTOC_AUTH_CACHE_KEY);
  if (redirectRoute) {
    window.location.replace(redirectRoute);
  }
};
