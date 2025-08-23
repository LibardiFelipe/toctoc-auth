interface RetryOptions {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  retryCondition?: (error: any) => boolean;
}

export const withRetry = async <T>(
  operation: () => Promise<T>,
  options: RetryOptions = {
    maxRetries: 3,
    baseDelay: 1000,
    maxDelay: 10000,
  }
): Promise<T> => {
  let lastError: any;

  for (let attempt = 0; attempt <= options.maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      if (attempt === options.maxRetries) {
        break;
      }

      if (options.retryCondition && !options.retryCondition(error)) {
        break;
      }

      const delay = Math.min(
        options.baseDelay * Math.pow(2, attempt),
        options.maxDelay
      );

      const jitter = Math.random() * 0.1 * delay;

      await new Promise((resolve) => setTimeout(resolve, delay + jitter));
    }
  }

  throw lastError;
};

export const isRetryableError = (error: any): boolean => {
  if (error.name === "NetworkError" || error.name === "TypeError") {
    return true;
  }

  const retryableStatusCodes = [408, 429, 500, 502, 503, 504];

  if (error.response?.status) {
    return retryableStatusCodes.includes(error.response.status);
  }

  return false;
};
