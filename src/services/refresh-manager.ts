import CryptoJS from "crypto-js";

const LOCK_NAME = "toctoc-auth:session";

export const createSessionId = () => CryptoJS.lib.WordArray.random(16).toString();

export const hasSessionLock = () =>
  typeof navigator !== "undefined" && typeof navigator.locks?.request === "function";

/** All refresh, login and logout writes share the same origin-wide lock. */
export const withSessionLock = async <T>(operation: () => Promise<T> | T): Promise<T> => {
  if (!hasSessionLock()) throw new Error("Web Locks are required for token refresh");
  return navigator.locks.request(LOCK_NAME, operation);
};

/** Login/logout remain available without Web Locks, when refresh is disabled. */
export const withOptionalSessionLock = async <T>(operation: () => Promise<T> | T): Promise<T> =>
  hasSessionLock() ? withSessionLock(operation) : operation();
