"use client";

import { usePathname } from "next/navigation";

export function NavWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname === "/") return null;
  return <>{children}</>;
}

export function ContentWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return <div className={pathname === "/" ? "" : "pt-16"}>{children}</div>;
}
