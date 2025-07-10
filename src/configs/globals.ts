import { type NavigateFunction } from "react-router-dom";
import { localStorageService } from "../services";
import {
  type TocTocAuthContent,
  type TocTocAuthProviderConfig,
} from "../types";

const cacheKey = "toctoc-auth";

let globalConfig: TocTocAuthProviderConfig;
let navigate: NavigateFunction;

const getNavigateFunction = (): NavigateFunction => {
  if (!navigate) {
    throw new Error(
      "Navigate function is not set. Please set it using setNavigateFunction."
    );
  }
  return navigate;
};

const setNavigateFunction = (navigateFunction: NavigateFunction) => {
  navigate = navigateFunction;
};

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
  setNavigateFunction,
  getNavigateFunction,
  getGlobalConfig,
  getAuthContent,
};
