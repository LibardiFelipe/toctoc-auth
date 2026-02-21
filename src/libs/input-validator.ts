const BLOCKED_KEYS = ["__proto__", "constructor", "prototype"];

/**
 * Sanitizes input data to prevent prototype pollution attacks.
 * Recursively processes nested objects and strips dangerous keys.
 *
 * @param data - The input data to sanitize
 * @returns A sanitized copy of the input object
 * @throws Error if input is null, undefined, or not a plain object
 */
export const sanitizeInput = (data: unknown): object => {
  if (data === null || data === undefined) {
    throw new Error("Input data is required");
  }

  if (typeof data !== "object" || Array.isArray(data)) {
    throw new Error("Input must be a plain object");
  }

  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(data)) {
    // Skip dangerous prototype pollution keys
    if (BLOCKED_KEYS.includes(key)) {
      continue;
    }

    // Recursively sanitize nested objects (but not arrays)
    if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      sanitized[key] = sanitizeInput(value);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
};
