import React, { JSX } from "react";
import { globals } from "../configs";
import { useTocTocAuth } from "../hooks";
import { utils } from "../libs";

interface TocTocGuardProps<TRole> {
  blurRadius?: number;
  children: React.ReactNode;
  style?: React.CSSProperties;
  lockIcon?: React.ReactNode;
  allowedRoles: TRole[];
}

export const TocTocGuard = <TRole,>({
  children,
  blurRadius = 3,
  style,
  lockIcon,
  allowedRoles,
}: TocTocGuardProps<TRole>): JSX.Element => {
  const { getUser } = useTocTocAuth();
  const configs = globals.getGlobalConfig();

  const userLocation =
    configs.providers.credentials?.signInJsonResponseUser?.location;
  if (!userLocation || userLocation.length === 0) {
    throw new Error(
      `${utils.nameOf(
        () => configs.providers.credentials?.signInJsonResponseUser
      )}.${utils.nameOf(
        () => configs.providers.credentials?.signInJsonResponseUser?.location
      )} is not defined.`
    );
  }

  const roleLocation = userLocation.concat(
    configs.providers.credentials?.signInJsonResponseUser?.roleLocation ?? []
  );
  if (
    !roleLocation ||
    roleLocation.length === 0 ||
    utils.areStringArraysEquivalent(roleLocation, userLocation)
  ) {
    throw new Error(
      `${utils.nameOf(
        () => configs.providers.credentials?.signInJsonResponseUser
      )}.${utils.nameOf(
        () =>
          configs.providers.credentials?.signInJsonResponseUser?.roleLocation
      )} is not properly defined.`
    );
  }

  const currentRole = utils.getNestedProperty<TRole>(getUser(), roleLocation);
  const canAccess = allowedRoles.includes(currentRole!);
  if (canAccess) return <>{children}</>;

  return (
    <div
      style={{
        position: "relative",
        display: "inline-block",
        ...style,
      }}
    >
      <div
        style={{
          zIndex: 1,
          top: "50%",
          left: "50%",
          position: "absolute",
          pointerEvents: "none",
          transform: "translate(-50%, -50%)",
        }}
      >
        {lockIcon}
      </div>
      <div
        style={{
          filter: `blur(${blurRadius}px)`,
        }}
      >
        {children}
      </div>
    </div>
  );
};
