import { useEffect } from "react";
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
}: TocTocProps) => {
  const navigate = useNavigate();
  const { isAuthenticated } = useTocTocAuth();

  const shouldRedirect =
    (reverse && isAuthenticated) || (!reverse && !isAuthenticated);

  useEffect(() => {
    if (shouldRedirect) {
      navigate(redirectTo, { replace: true });
    }
  }, [shouldRedirect, navigate, redirectTo]);

  if (shouldRedirect) {
    return null;
  }

  return <>{children}</>;
};
