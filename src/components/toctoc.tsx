import React, { JSX, useEffect } from "react";
import { useTocTocAuth } from "../hooks";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";

type TocTocProps = {
  reverse?: boolean;
  redirectTo: string;
  children: React.ReactNode;
};

export const TocToc = ({
  children,
  redirectTo,
  reverse = false,
}: TocTocProps): JSX.Element | null => {
  const { isAuthenticated } = useTocTocAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [searchParams] = useSearchParams();
  const redirectParam = searchParams.get("redirect");
  const hasRedirectParam = !!redirectParam;
  const shouldSkipTocToc =
    searchParams.get("skipTocToc") === "true" && hasRedirectParam;

  const shouldRedirect =
    (reverse && isAuthenticated) || (!reverse && !isAuthenticated);

  useEffect(() => {
    if (shouldRedirect && !shouldSkipTocToc) {
      const pathName = location.pathname;
      const params = searchParams.toString();
      const redirect = `${pathName}?${params}`;
      const linkFinal = `${redirectTo}?redirect=${encodeURIComponent(
        redirect
      )}`;
      console.log("linkFinal: ", linkFinal);

      navigate(linkFinal, {
        replace: true,
      });
    }
  }, [
    searchParams,
    shouldSkipTocToc,
    shouldRedirect,
    navigate,
    redirectTo,
    location,
  ]);

  if (shouldRedirect) {
    return null;
  }

  return <>{children}</>;
};
