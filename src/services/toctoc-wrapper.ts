import { type AxiosInstance, type InternalAxiosRequestConfig } from "axios";
import { credentialsService, localStorageService } from ".";
import { utils } from "../libs";
import { type TocTocAuthConfig, type TocTocAuthContent } from "../types";
import { TOCTOC_AUTH_CACHE_KEY } from "../providers/toctoc-provider";

export const createTocTocAxiosWrapper = (
  tocTocConfig: TocTocAuthConfig,
  api: AxiosInstance
): AxiosInstance => {
  const signOutRedirectRoute =
    tocTocConfig.providers.credentials?.redirectClientRoutes.afterSignOut;

  api.interceptors.request.use(
    (config: InternalAxiosRequestConfig) => {
      const authContent = localStorageService.getItem<TocTocAuthContent>(
        TOCTOC_AUTH_CACHE_KEY,
        tocTocConfig.encryptionKey
      );

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
          const authContent = localStorageService.getItem<TocTocAuthContent>(
            TOCTOC_AUTH_CACHE_KEY,
            tocTocConfig.encryptionKey
          );

          if (authContent?.refreshToken) {
            const response = await credentialsService.refreshTokenAsync(
              tocTocConfig,
              authContent.refreshToken
            );

            if (!response.isSuccess) {
              console.warn("Failed to refresh token. Clearing session.");
              clearAndRedirect(signOutRedirectRoute);
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

          console.warn("Failed to refresh token. Clearing session.");
          clearAndRedirect(signOutRedirectRoute);
        } catch (refreshError) {
          console.error("Error refreshing token:", refreshError);
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
