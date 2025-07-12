import { type ReactNode, useState } from "react";
import { type TocTocAuthContent, type TocTocResult } from "../types";
import { credentialsService, localStorageService } from "../services";
import { globals } from "../configs";
import { utils } from "../libs";
import { TocTocAuthContext } from "../contexts";
import { useNavigate, useSearchParams } from "react-router-dom";

export type TocTocAuthConfig = {
  apiBaseUrl: string;
  encryptionKey: string;
  providers: {
    credentials?: {
      refreshTokenApiRoute: string;
      signUpApiRoute: string;
      signInApiRoute: string;
      signInAfterSignUp: boolean;
      redirectClientRoutes: {
        afterSignUp?: string;
        afterSignIn: string;
        afterSignOut: string;
      };
      signInJsonResponseAccessTokenLocation: string[];
      signInJsonResponseRefreshTokenLocation: string[];
      signInJsonResponseUser?: {
        location: string[];
        roleLocation?: string[];
      };
    };
  };
};

type TocTocAuthProviderProps = {
  config: TocTocAuthConfig;
  children: ReactNode;
};

export const TocTocAuthProvider = ({
  config,
  children,
}: TocTocAuthProviderProps) => {
  const { credentials } = config.providers;

  const navigate = useNavigate();
  globals.setGlobalConfig(config);

  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const authContent = localStorageService.getItem<TocTocAuthContent>(
    globals.cacheKey,
    config.encryptionKey
  );

  const [searchParams] = useSearchParams();

  const signUpWithCredentialsAsync = async <TApiResponse,>(
    data: object
  ): Promise<TocTocResult<TApiResponse>> => {
    setIsAuthenticating(true);
    try {
      const response = await credentialsService.registerAsync<TApiResponse>(
        config,
        data
      );

      if (!response.isSuccess) {
        return response;
      }

      if (credentials?.signInAfterSignUp) {
        const signInResponse = await signInWithCredentialsAsync<TApiResponse>(
          data
        );

        return signInResponse;
      }

      const target = decodeURIComponent(
        searchParams.get("redirect") ??
          credentials?.redirectClientRoutes.afterSignUp ??
          ""
      );

      if (target) {
        navigate(target, { replace: true });
      }

      return response;
    } finally {
      setIsAuthenticating(false);
    }
  };

  const signInWithCredentialsAsync = async <TApiResponse,>(
    data: object
  ): Promise<TocTocResult<TApiResponse>> => {
    setIsAuthenticating(true);
    try {
      const response = await credentialsService.loginAsync<TApiResponse>(
        config,
        data
      );

      if (!response.isSuccess) {
        return response;
      }

      const accessTokenPath = config.providers.credentials
        ?.signInJsonResponseAccessTokenLocation ?? ["accessToken"];
      const refreshTokenPath = config.providers.credentials
        ?.signInJsonResponseRefreshTokenLocation ?? ["refreshToken"];

      const userPath =
        config.providers.credentials?.signInJsonResponseUser?.location ?? [];

      const authContent: TocTocAuthContent = {
        provider: "credentials",
        user: utils.getNestedProperty<object>(response.responseBody, userPath),
        accessToken: utils.getNestedProperty<string>(
          response.responseBody,
          accessTokenPath
        )!,
        refreshToken: utils.getNestedProperty<string>(
          response.responseBody,
          refreshTokenPath
        )!,
      };

      localStorageService.setItem(
        globals.cacheKey,
        authContent,
        config.encryptionKey
      );

      const target = decodeURIComponent(
        searchParams.get("redirect") ??
          credentials?.redirectClientRoutes.afterSignIn ??
          ""
      );

      if (target) {
        navigate(target, { replace: true });
      }

      return response;
    } finally {
      setIsAuthenticating(false);
    }
  };

  const getUser = <TUser,>(): TUser | undefined => {
    const user = authContent?.user;
    return user as TUser | undefined;
  };

  const signOutAsync = async () => {
    setIsAuthenticating(true);

    try {
      localStorageService.removeItem(globals.cacheKey);

      if (credentials?.redirectClientRoutes.afterSignOut) {
        navigate(credentials.redirectClientRoutes.afterSignOut, {
          replace: true,
        });
      }
    } finally {
      setIsAuthenticating(false);
    }
  };

  return (
    <TocTocAuthContext.Provider
      value={{
        signUpWithCredentialsAsync,
        signInWithCredentialsAsync,
        isAuthenticating,
        isAuthenticated: !!authContent?.accessToken,
        signOutAsync,
        getUser,
      }}
    >
      {children}
    </TocTocAuthContext.Provider>
  );
};
