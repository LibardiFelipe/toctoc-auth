import React, { JSX } from "react";
import { useTocTocAuth, useTocTocConfig } from "../hooks";
import { utils, createConfigError } from "../libs";

interface TocTocGuardProps<TRole> {
  blurRadius?: number;
  children: React.ReactNode;
  style?: React.CSSProperties;
  lockIcon?: React.ReactNode;
  allowedRoles: TRole[];
  hideContent?: boolean;
}

/**
 * TocTocGuard provides client-side role-based UI protection.
 *
 * @warning This is a UX feature, NOT a security control.
 * Always enforce authorization server-side. This component only hides
 * UI elements and should not protect sensitive data.
 *
 * When `hideContent` is true, protected content is not rendered in the DOM at all.
 * When false (default), content is rendered but visually blurred.
 */
export const TocTocGuard = <TRole,>({
  children,
  blurRadius = 3,
  style,
  lockIcon,
  allowedRoles,
  hideContent = false,
}: TocTocGuardProps<TRole>): JSX.Element => {
  const { getUser } = useTocTocAuth();
  const configs = useTocTocConfig();

  const userLocation =
    configs.providers.credentials?.signInJsonResponseUser?.location;
  if (!userLocation || userLocation.length === 0) {
    throw createConfigError(
      `${utils.nameOf(
        () => configs.providers.credentials?.signInJsonResponseUser
      )}.${utils.nameOf(
        () => configs.providers.credentials?.signInJsonResponseUser?.location
      )} is not defined.`,
      "Role-based access configuration error. Please contact support."
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
    throw createConfigError(
      `${utils.nameOf(
        () => configs.providers.credentials?.signInJsonResponseUser
      )}.${utils.nameOf(
        () =>
          configs.providers.credentials?.signInJsonResponseUser?.roleLocation
      )} is not properly defined.`,
      "Role-based access configuration error. Please contact support."
    );
  }

  const currentRole = utils.getNestedProperty<TRole>(getUser(), roleLocation);
  const canAccess = allowedRoles.includes(currentRole!);
  if (canAccess) return <>{children}</>;

  if (hideContent) {
    return (
      <div style={{ ...style }}>
        {lockIcon ?? <span>Access Restricted</span>}
      </div>
    );
  }

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
