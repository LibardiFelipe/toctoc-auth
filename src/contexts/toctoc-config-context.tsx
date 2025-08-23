import { createContext, useContext } from "react";
import { TocTocAuthConfig } from "../types";

export const TocTocConfigContext = createContext<TocTocAuthConfig | null>(null);
