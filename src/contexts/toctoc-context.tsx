import { createContext } from "react";
import { type TocTocResult } from "../types/toctoc-result";

type TocTocContextType = {
  isAuthenticated: boolean;
  isAuthenticating: boolean;
  signUpWithCredentialsAsync: <TResponse>(
    data: object
  ) => Promise<TocTocResult<TResponse>>;
  signInWithCredentialsAsync: <TResponse>(
    data: object
  ) => Promise<TocTocResult<TResponse>>;
  signOutAsync: () => Promise<void>;
  getUser: <TUser>() => TUser | undefined;
};

export const TocTocContext = createContext({} as TocTocContextType);
