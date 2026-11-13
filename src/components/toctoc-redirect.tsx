import React, { type JSX, useEffect } from "react";
import { useTocTocAuth } from "../hooks";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { validateRedirectUrl } from "../libs";

type TocTocProps = {
  reverse?: boolean;
  to: string;
  children: React.ReactNode;
};

export const TocTocRedirect = ({
  children,
  to,
  reverse = false,
}: TocTocProps): JSX.Element | null => {
  const { isAuthenticated, isHydrating } = useTocTocAuth();

  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const currentPath = location.pathname;

  const shouldRedirectNormal = !isHydrating && !isAuthenticated && !reverse;
  const shouldRedirectReverse = !isHydrating && isAuthenticated && reverse;

  useEffect(() => {
    if (shouldRedirectNormal) {
      const currentSearchParams = searchParams.toString().trim();
      const hasSearchParams = currentSearchParams.length > 2;

      const target =
        to +
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
        navigate(to, { replace: true });
        return;
      }

      const target = validateRedirectUrl(redirectSearchParam, to);
      navigate(target, { replace: true });
    }
  }, [shouldRedirectReverse, searchParams, currentPath, navigate]);

  if (isHydrating || shouldRedirectNormal || shouldRedirectReverse) {
    return null;
  }

  return <>{children}</>;
};
