import { type NavigateFunction } from "react-router-dom";
import { localStorageService } from "../services";
import { type TocTocAuthContent, type TocTocAuthConfig } from "../types";

const cacheKey = "toctoc-auth";

let globalConfig: TocTocAuthConfig;
let navigate: NavigateFunction;

const setGlobalConfig = (config: TocTocAuthConfig) => {
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

const getGlobalConfig = (): TocTocAuthConfig => {
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
