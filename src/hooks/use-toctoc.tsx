import { useContext } from "react";
import { TocTocAuthContext } from "../contexts";

export const useTocTocAuth = () => {
  const context = useContext(TocTocAuthContext);
  if (!context) {
    throw new Error("useTocTocAuth must be used within a TocTocAuthProvider");
  }
  return context;
};
