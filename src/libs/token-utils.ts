// Payload decoding is not signature verification and must not be used for authorization.
export const isNonemptyToken = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

export const getTokenExpiration = (token: string): number | undefined => {
  try {
    const parts = token.split(".");
    if (parts.length !== 3 || !/^[A-Za-z0-9_-]+$/.test(parts[1]) || parts[1].length % 4 === 1) return undefined;
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const bytes = Uint8Array.from(atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, "=")), c => c.charCodeAt(0));
    const payload = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
    const expiry = payload?.exp;
    if (typeof expiry !== "number" || !Number.isFinite(expiry) || !Number.isFinite(expiry * 1000)) return undefined;
    return expiry * 1000;
  } catch {
    return undefined;
  }
};

export const isTokenExpired = (token: string): boolean => {
  const expiration = getTokenExpiration(token);
  return expiration === undefined || expiration <= Date.now();
};
