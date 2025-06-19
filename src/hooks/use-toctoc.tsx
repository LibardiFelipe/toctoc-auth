import { useContext } from "react";
import { TocTocContext } from "../contexts/toctoc-context";

export const useTocTocAuth = () => {
  const context = useContext(TocTocContext);
  if (!context) {
    throw new Error("useTocTocAuth must be used within a TocTocAuthProvider");
  }
  return context;
};
