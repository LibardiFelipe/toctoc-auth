import { useEffect } from "react";
import { useTocTocAuth } from "../hooks";

type TocTocProps = {
  reverse?: boolean;
  redirectTo: string;
  children: React.ReactNode;
  loadingScreen?: React.ReactNode;
};

export const TocToc = ({
  children,
  redirectTo,
  loadingScreen,
  reverse = false,
}: TocTocProps) => {
  const { isAuthenticated } = useTocTocAuth();

  const shouldRedirect =
    (reverse && isAuthenticated) || (!reverse && !isAuthenticated);

  useEffect(() => {
    if (shouldRedirect) {
      window.location.replace(redirectTo);
    }
  }, [shouldRedirect]);

  if (shouldRedirect) {
    return loadingScreen ?? null;
  }

  return <>{children}</>;
};
