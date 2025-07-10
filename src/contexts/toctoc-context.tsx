import { createContext } from "react";
import { type TocTocResult } from "../types";

type TocTocAuthContextType = {
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

export const TocTocAuthContext = createContext({} as TocTocAuthContextType);
