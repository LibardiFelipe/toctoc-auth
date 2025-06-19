import type { TocTocAuthProviderConfig } from "../providers/toctoc-provider";
import { type TocTocResult } from "../types/toctoc-result";
import { utils } from "../libs/utils";

const { nameOf, hasNestedProperty } = utils;

const registerAsync = async <TResponse>(
  config: TocTocAuthProviderConfig,
  data: object
): Promise<TocTocResult<TResponse>> => {
  const baseUrl = config.apiBaseUrl;
  const path = config.providers.credentials?.signUpApiRoute;

  if (!path) {
    throw new Error(
      `Please set the '${nameOf(
        () => config.providers.credentials?.signUpApiRoute
      )}' in the credentials provider configuration.`
    );
  }

  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  const body = (await response.json()) as TResponse;
  return {
    isSuccess: response.ok,
    responseBody: body,
  };
};

const loginAsync = async <TResponse>(
  config: TocTocAuthProviderConfig,
  data: object
): Promise<TocTocResult<TResponse>> => {
  const baseUrl = config.apiBaseUrl;
  const path = config.providers.credentials?.signInApiRoute;
  const accessTokenPath = config.providers.credentials
    ?.signInResponseJsonAccessTokenLocation ?? ["accessToken"];
  const refreshTokenPath = config.providers.credentials
    ?.signInResponseJsonRefreshTokenLocation ?? ["refreshToken"];
  const userPath = config.providers.credentials?.signInResponseJsonUserLocation;

  if (!path) {
    throw new Error(
      `Please set the '${nameOf(
        () => config.providers.credentials?.signInApiRoute
      )}' in the credentials provider configuration.`
    );
  }

  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  const body = (await response.json()) as TResponse;
  if (!response.ok) {
    return {
      isSuccess: false,
      responseBody: body,
    };
  }

  if (!body || Object.keys(body).length === 0) {
    throw new Error(
      `The response body from the '${nameOf(
        () => config.providers.credentials?.signInApiRoute
      )}' endpoint is empty. Please check the API implementation.`
    );
  }

  if (!hasNestedProperty(body, accessTokenPath)) {
    throw new Error(
      `The response body from '${nameOf(
        () => config.providers.credentials?.signInApiRoute
      )}' endpoint does not contain the expected '${accessTokenPath.join(
        "."
      )}' property. Please check the API implementation.`
    );
  }

  if (!hasNestedProperty(body, refreshTokenPath)) {
    throw new Error(
      `The response body from '${nameOf(
        () => config.providers.credentials?.signInApiRoute
      )}' endpoint does not contain the expected '${refreshTokenPath.join(
        "."
      )}' property. Please check the API implementation.`
    );
  }

  if (userPath && !hasNestedProperty(body, userPath)) {
    throw new Error(
      `The response body from '${nameOf(
        () => config.providers.credentials?.signInApiRoute
      )}' endpoint does not contain the expected '${userPath.join(
        "."
      )}' property. Please check the API implementation.`
    );
  }

  return {
    isSuccess: response.ok,
    responseBody: body,
  };
};

export const credentialsService = {
  registerAsync,
  loginAsync,
};
