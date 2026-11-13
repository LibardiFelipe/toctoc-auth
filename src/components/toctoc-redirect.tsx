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

  const shouldRedirectNormal = !isHydrating && !isAuthenticated && !reverse;
  const shouldRedirectReverse = !isHydrating && isAuthenticated && reverse;

  useEffect(() => {
    if (shouldRedirectNormal) {
      const hashIndex = to.indexOf("#");
      const hash = hashIndex < 0 ? "" : to.slice(hashIndex);
      const beforeHash = hashIndex < 0 ? to : to.slice(0, hashIndex);
      const queryIndex = beforeHash.indexOf("?");
      const path = queryIndex < 0 ? beforeHash : beforeHash.slice(0, queryIndex);
      const params = new URLSearchParams(queryIndex < 0 ? "" : beforeHash.slice(queryIndex + 1));
      params.set("redirect", location.pathname + location.search + location.hash);
      const target = `${path}?${params.toString()}${hash}`;
      navigate(target, { replace: true });
    }
  }, [shouldRedirectNormal, location.pathname, location.search, location.hash, to, navigate]);

  useEffect(() => {
    if (shouldRedirectReverse) {
      const target = validateRedirectUrl(searchParams.get("redirect"), to);
      navigate(target, { replace: true });
    }
  }, [shouldRedirectReverse, searchParams, to, navigate]);

  if (isHydrating || shouldRedirectNormal || shouldRedirectReverse) {
    return null;
  }

  return <>{children}</>;
};
