import { useContext } from "react";
import { TocTocConfigContext } from "../contexts";
import { TocTocAuthConfig } from "../types";

export const useTocTocConfig = (): TocTocAuthConfig => {
  const config = useContext(TocTocConfigContext);
  if (!config) {
    throw new Error("useTocTocConfig must be used within TocTocAuthProvider");
  }
  return config;
};
