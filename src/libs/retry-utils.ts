interface RetryOptions<T> {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  retryCondition?: (error: any) => boolean;
  retryResult?: (result: T) => boolean;
  discardResult?: (result: T) => Promise<void>;
}

export const withRetry = async <T>(
  operation: () => Promise<T>,
  options: RetryOptions<T> = {
    maxRetries: 3,
    baseDelay: 1000,
    maxDelay: 10000,
  }
): Promise<T> => {
  for (let attempt = 0; attempt <= options.maxRetries; attempt++) {
    let result: T;
    try {
      result = await operation();
    } catch (error) {
      if (attempt === options.maxRetries || (options.retryCondition && !options.retryCondition(error))) throw error;
      await waitForRetry(attempt, options);
      continue;
    }
    if (attempt === options.maxRetries || !options.retryResult?.(result)) return result;
    await options.discardResult?.(result);
    await waitForRetry(attempt, options);
  }
  throw new Error("Invalid retry configuration");
};

const waitForRetry = async (attempt: number, options: { baseDelay: number; maxDelay: number }) => {
  const delay = Math.min(options.baseDelay * Math.pow(2, attempt), options.maxDelay);
  const jitter = Math.random() * 0.1 * delay;
  await new Promise((resolve) => setTimeout(resolve, delay + jitter));
};

export const isRetryableStatus = (status: number): boolean =>
  [408, 429, 500, 502, 503, 504].includes(status);

export const isRetryableError = (error: any): boolean => {
  if (error?.name === "NetworkError" || error?.name === "TypeError") {
    return true;
  }

  if (error?.response?.status) {
    return isRetryableStatus(error.response.status);
  }

  return false;
};
