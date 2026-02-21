import {
  utils,
  withRetry,
  isRetryableError,
  sanitizeInput,
  createConfigError,
} from "../libs";
import { type TocTocAuthConfig, type TocTocResult } from "../types";

const { nameOf, hasNestedProperty } = utils;

const registerAsync = async <TResponse>(
  config: TocTocAuthConfig,
  data: object
): Promise<TocTocResult<TResponse>> => {
  const baseUrl = config.apiBaseUrl;
  const path = config.providers.credentials?.signUpApiRoute;

  if (!path) {
    throw createConfigError(
      `Please set the '${nameOf(
        () => config.providers.credentials?.signUpApiRoute
      )}' in the credentials provider configuration.`,
      "Authentication configuration error. Please contact support."
    );
  }

  // Sanitize input to prevent prototype pollution
  const sanitizedData = sanitizeInput(data);

  const response = await withRetry(
    () =>
      fetch(`${baseUrl}${path}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(sanitizedData),
      }),
    {
      maxRetries: config.retryOptions?.maxRetries ?? 3,
      baseDelay: config.retryOptions?.baseDelay ?? 1000,
      maxDelay: config.retryOptions?.maxDelay ?? 5000,
      retryCondition: isRetryableError,
    }
  );

  const body = (await response.json()) as TResponse;
  return {
    isSuccess: response.ok,
    responseBody: body,
  };
};

const loginAsync = async <TResponse>(
  config: TocTocAuthConfig,
  data: object
): Promise<TocTocResult<TResponse>> => {
  const baseUrl = config.apiBaseUrl;
  const path = config.providers.credentials?.signInApiRoute;
  const accessTokenPath = config.providers.credentials
    ?.signInJsonResponseAccessTokenLocation ?? ["accessToken"];
  const refreshTokenPath = config.providers.credentials
    ?.signInJsonResponseRefreshTokenLocation ?? ["refreshToken"];
  const userPath =
    config.providers.credentials?.signInJsonResponseUser?.location;
  const rolePath =
    config.providers.credentials?.signInJsonResponseUser?.roleLocation;

  if (!path) {
    throw createConfigError(
      `Please set the '${nameOf(
        () => config.providers.credentials?.signInApiRoute
      )}' in the credentials provider configuration.`,
      "Authentication configuration error. Please contact support."
    );
  }

  // Sanitize input to prevent prototype pollution
  const sanitizedData = sanitizeInput(data);

  const response = await withRetry(
    () =>
      fetch(`${baseUrl}${path}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(sanitizedData),
      }),
    {
      maxRetries: config.retryOptions?.maxRetries ?? 3,
      baseDelay: config.retryOptions?.baseDelay ?? 1000,
      maxDelay: config.retryOptions?.maxDelay ?? 5000,
      retryCondition: isRetryableError,
    }
  );

  const body = (await response.json()) as TResponse;
  if (!response.ok) {
    return {
      isSuccess: false,
      responseBody: body,
    };
  }

  if (!body || Object.keys(body).length === 0) {
    throw createConfigError(
      `The response body from the '${nameOf(
        () => config.providers.credentials?.signInApiRoute
      )}' endpoint is empty. Please check the API implementation.`,
      "Authentication failed. Please try again."
    );
  }

  if (!hasNestedProperty(body, accessTokenPath)) {
    throw createConfigError(
      `The response body from '${nameOf(
        () => config.providers.credentials?.signInApiRoute
      )}' endpoint does not contain the expected '${accessTokenPath.join(
        "."
      )}' property. Please check the API implementation.`,
      "Authentication failed. Please try again."
    );
  }

  if (!hasNestedProperty(body, refreshTokenPath)) {
    throw createConfigError(
      `The response body from '${nameOf(
        () => config.providers.credentials?.signInApiRoute
      )}' endpoint does not contain the expected '${refreshTokenPath.join(
        "."
      )}' property. Please check the API implementation.`,
      "Authentication failed. Please try again."
    );
  }

  if (userPath && !hasNestedProperty(body, userPath)) {
    throw createConfigError(
      `The response body from '${nameOf(
        () => config.providers.credentials?.signInApiRoute
      )}' endpoint does not contain the expected '${userPath.join(
        "."
      )}' property. Please check the API implementation.`,
      "Authentication failed. Please try again."
    );
  }

  if (rolePath) {
    const roleLocation = userPath?.concat(rolePath) ?? [];
    if (!hasNestedProperty(body, roleLocation)) {
      throw createConfigError(
        `The response body from '${nameOf(
          () => config.providers.credentials?.signInApiRoute
        )}' endpoint does not contain the expected '${roleLocation.join(
          "."
        )}' property. Please check the API implementation.`,
        "Authentication failed. Please try again."
      );
    }
  }

  return {
    isSuccess: response.ok,
    responseBody: body,
  };
};

const refreshTokenAsync = async <TResponse>(
  config: TocTocAuthConfig,
  refreshToken: string
): Promise<TocTocResult<TResponse>> => {
  const baseUrl = config.apiBaseUrl;
  const path = config.providers.credentials?.refreshTokenApiRoute;
  const accessTokenPath = config.providers.credentials
    ?.signInJsonResponseAccessTokenLocation ?? ["accessToken"];
  const refreshTokenPath = config.providers.credentials
    ?.signInJsonResponseRefreshTokenLocation ?? ["refreshToken"];
  const userPath =
    config.providers.credentials?.signInJsonResponseUser?.location;

  if (!path) {
    throw createConfigError(
      `Please set the '${nameOf(
        () => config.providers.credentials?.refreshTokenApiRoute
      )}' in the credentials provider configuration.`,
      "Authentication configuration error. Please contact support."
    );
  }

  const refreshUrl = `${baseUrl}${path}`;
  const response = await withRetry(
    () =>
      fetch(refreshUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ refreshToken }),
      }),
    {
      maxRetries: config.retryOptions?.maxRetries ?? 3,
      baseDelay: config.retryOptions?.baseDelay ?? 1000,
      maxDelay: config.retryOptions?.maxDelay ?? 5000,
      retryCondition: isRetryableError,
    }
  );

  const body = (await response.json()) as TResponse;
  if (!response.ok) {
    return {
      isSuccess: false,
      responseBody: body,
    };
  }

  if (!body || Object.keys(body).length === 0) {
    throw createConfigError(
      `The response body from the '${nameOf(
        () => config.providers.credentials?.refreshTokenApiRoute
      )}' endpoint is empty. Please check the API implementation.`,
      "Token refresh failed. Please sign in again."
    );
  }

  if (!hasNestedProperty(body, accessTokenPath)) {
    throw createConfigError(
      `The response body from '${nameOf(
        () => config.providers.credentials?.refreshTokenApiRoute
      )}' endpoint does not contain the expected '${accessTokenPath.join(
        "."
      )}' property. Please check the API implementation.`,
      "Token refresh failed. Please sign in again."
    );
  }

  if (!hasNestedProperty(body, refreshTokenPath)) {
    throw createConfigError(
      `The response body from '${nameOf(
        () => config.providers.credentials?.refreshTokenApiRoute
      )}' endpoint does not contain the expected '${refreshTokenPath.join(
        "."
      )}' property. Please check the API implementation.`,
      "Token refresh failed. Please sign in again."
    );
  }

  if (userPath && !hasNestedProperty(body, userPath)) {
    throw createConfigError(
      `The response body from '${nameOf(
        () => config.providers.credentials?.refreshTokenApiRoute
      )}' endpoint does not contain the expected '${userPath.join(
        "."
      )}' property. Please check the API implementation.`,
      "Token refresh failed. Please sign in again."
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
  refreshTokenAsync,
};
