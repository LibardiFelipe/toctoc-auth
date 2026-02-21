const isDevelopment = process.env.NODE_ENV === "development" || process.env.NODE_ENV === "dev";

export const logger = {
  warn: (message: string, ...args: unknown[]) => {
    if (isDevelopment) {
      console.warn(`[TocToc Auth] ${message}`, ...args);
    }
  },
  error: (message: string, ...args: unknown[]) => {
    if (isDevelopment) {
      console.error(`[TocToc Auth] ${message}`, ...args);
    }
  },
  info: (message: string, ...args: unknown[]) => {
    if (isDevelopment) {
      console.info(`[TocToc Auth] ${message}`, ...args);
    }
  },
};
