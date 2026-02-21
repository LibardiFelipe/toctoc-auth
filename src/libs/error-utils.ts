/**
 * Creates an environment-aware error.
 * In development: returns error with detailed developer message.
 * In production: logs detailed message to console, returns error with generic user message.
 *
 * @param developerMessage - Detailed message for debugging (shown in dev, logged in prod)
 * @param userMessage - Generic message safe for end users (shown in prod)
 * @returns An Error instance with the appropriate message
 */
export const createConfigError = (
  developerMessage: string,
  userMessage: string = "Authentication configuration error. Please contact support."
): Error => {
  const isDevelopment = process.env.NODE_ENV === "development";

  if (isDevelopment) {
    return new Error(developerMessage);
  }

  // In production, log the detailed message for debugging but don't expose it
  console.error("[TocToc Auth] Config Error:", developerMessage);
  return new Error(userMessage);
};
