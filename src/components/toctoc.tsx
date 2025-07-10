import React, { type JSX, useEffect } from "react";
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

  const currentPath = location.pathname;

  const shouldRedirectNormal = !isAuthenticated && !reverse;
  const shouldRedirectReverse = isAuthenticated && reverse;

  useEffect(() => {
    if (shouldRedirectNormal) {
      const currentSearchParams = searchParams.toString().trim();
      const hasSearchParams = currentSearchParams.length > 2;

      const target =
        redirectTo +
        "?" +
        "redirect=" +
        encodeURIComponent(
          `${currentPath}${hasSearchParams ? `?${currentSearchParams}` : ""}`
        );
      navigate(target, { replace: true });
    }
  }, [shouldRedirectNormal, searchParams, currentPath, navigate]);

  useEffect(() => {
    if (shouldRedirectReverse) {
      const redirectSearchParam =
        searchParams.get("redirect")?.toString()?.trim() ?? "";
      const hasRedirectParam = redirectSearchParam.length > 2;

      if (!hasRedirectParam) {
        navigate(redirectTo, { replace: true });
        return;
      }

      const target = decodeURIComponent(redirectSearchParam ?? redirectTo);
      navigate(target, { replace: true });
    }
  }, [shouldRedirectReverse, searchParams, currentPath, navigate]);

  if (shouldRedirectNormal || shouldRedirectReverse) {
    return null;
  }

  return <>{children}</>;
};
