import React, { JSX, useEffect } from "react";
import { useTocTocAuth } from "../hooks";
import { useNavigate } from "react-router-dom";

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
  const navigate = useNavigate();
  const { isAuthenticated } = useTocTocAuth();
  const currentPath = window.location.pathname;

  const params = new URLSearchParams(window.location.search);
  const skipTocToc = params.get("skipTocToc") === "true";

  const shouldRedirect =
    !skipTocToc &&
    ((reverse && isAuthenticated) || (!reverse && !isAuthenticated));

  useEffect(() => {
    if (shouldRedirect) {
      navigate(`${redirectTo}?redirect=${currentPath}`, {
        replace: true,
      });
    }
  }, [shouldRedirect, navigate, redirectTo, currentPath]);

  useEffect(() => {
    if (skipTocToc) {
      const params = new URLSearchParams(window.location.search);
      params.delete("skipTocToc");

      const url = `${currentPath}?${params.toString()}`;

      navigate(url, {
        replace: true,
      });
    }
  }, [skipTocToc, navigate, currentPath]);

  if (shouldRedirect) {
    return null;
  }

  return <>{children}</>;
};
