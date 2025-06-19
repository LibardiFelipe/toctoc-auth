import { localStorageService } from "../services";
import { TocTocAuthContent, TocTocAuthProviderConfig } from "../types";

const cacheKey = "toctoc-auth";

let globalConfig: TocTocAuthProviderConfig;

const setGlobalConfig = (config: TocTocAuthProviderConfig) => {
  globalConfig = config;
};

const getEncryptionKey = (): string => {
  if (!globalConfig) {
    throw new Error("Global configuration is not set.");
  }

  return globalConfig.encryptionKey;
};

const getAuthContent = () => {
  if (!globalConfig) {
    throw new Error("Global configuration is not set.");
  }

  const encryptionKey = getEncryptionKey();
  return localStorageService.getItem<TocTocAuthContent>(
    cacheKey,
    encryptionKey
  );
};

const getGlobalConfig = (): TocTocAuthProviderConfig => {
  if (!globalConfig) {
    throw new Error("Global configuration is not set.");
  }
  return globalConfig;
};

export const globals = {
  cacheKey,
  setGlobalConfig,
  getGlobalConfig,
  getAuthContent,
};
