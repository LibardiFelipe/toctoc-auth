import { type ReactNode, useState } from "react";
import { TocTocAuthContent, TocTocResult } from "../types";
import { credentialsService, localStorageService } from "../services";
import { globals } from "../configs";
import { utils } from "../libs";
import { TocTocAuthContext } from "../contexts";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";

export type TocTocAuthProviderConfig = {
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
      signInResponseJsonAccessTokenLocation: string[];
      signInResponseJsonRefreshTokenLocation: string[];
      signInResponseJsonUserLocation?: string[];
    };
  };
};

type TocTocAuthProviderProps = {
  config: TocTocAuthProviderConfig;
  children: ReactNode;
};

export const TocTocAuthProvider = ({
  config,
  children,
}: TocTocAuthProviderProps) => {
  const { credentials } = config.providers;

  const navigate = useNavigate();
  globals.setNavigateFunction(navigate);
  globals.setGlobalConfig(config);

  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const authContent = localStorageService.getItem<TocTocAuthContent>(
    globals.cacheKey,
    config.encryptionKey
  );

  const [searchParams, setSearchParams] = useSearchParams();

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
      console.log("target: ", target);

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
        ?.signInResponseJsonAccessTokenLocation ?? ["accessToken"];
      const refreshTokenPath = config.providers.credentials
        ?.signInResponseJsonRefreshTokenLocation ?? ["refreshToken"];

      const userPath =
        config.providers.credentials?.signInResponseJsonUserLocation ?? [];

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
      console.log("target: ", target);

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
    if (!user) {
      console.error(
        `User is not authenticated or property '${utils.nameOf(
          () => config.providers.credentials?.signInResponseJsonUserLocation
        )}' is not defined at config object. After fixing these problems, you will need to sign in again.`
      );
    }

    return user as TUser;
  };

  const signOutAsync = async () => {
    setIsAuthenticating(true);

    // TODO: Read the authentication provider used to signIn
    // and call the signOut method of the provider.

    try {
      localStorageService.removeItem(globals.cacheKey);

      if (credentials?.redirectClientRoutes.afterSignOut) {
        globals.getNavigateFunction()(
          credentials.redirectClientRoutes.afterSignOut,
          { replace: true }
        );
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
