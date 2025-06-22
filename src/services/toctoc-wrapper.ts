import { AxiosInstance, InternalAxiosRequestConfig } from "axios";
import { globals } from "../configs";
import { credentialsService, localStorageService } from ".";
import { utils } from "../libs";
import { TocTocAuthContent } from "../types";

export const withTocTocAxiosWrapper = (api: AxiosInstance): AxiosInstance => {
  const globalConfig = globals.getGlobalConfig();
  const signOutRedirectRoute =
    globalConfig.providers.credentials?.redirectClientRoutes.afterSignOut;
  const cacheKey = globals.cacheKey;

  api.interceptors.request.use(
    (config: InternalAxiosRequestConfig) => {
      const authContent = globals.getAuthContent();
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
          const authContent = globals.getAuthContent();
          if (authContent?.refreshToken) {
            const response = await credentialsService.refreshTokenAsync(
              globalConfig,
              authContent.refreshToken
            );

            if (!response.isSuccess) {
              console.warn("Failed to refresh token. Clearing session.");
              clearAndRedirect(signOutRedirectRoute);
            }

            const accessTokenPath = globalConfig.providers.credentials
              ?.signInResponseJsonAccessTokenLocation ?? ["accessToken"];
            const refreshTokenPath = globalConfig.providers.credentials
              ?.signInResponseJsonRefreshTokenLocation ?? ["refreshToken"];
            const userPath =
              globalConfig.providers.credentials
                ?.signInResponseJsonUserLocation ?? [];

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
              cacheKey,
              updatedAuthContent,
              globalConfig.encryptionKey
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
  localStorageService.removeItem(globals.cacheKey);
  if (redirectRoute) {
    globals.getNavigateFunction()(redirectRoute, { replace: true });
  }
};
