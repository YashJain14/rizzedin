"use client";

import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function MainWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // Don't add left padding on landing page, onboarding, sign-in/sign-up, or chat pages
  const hideNavigation =
    pathname === "/" ||
    pathname === "/onboarding" ||
    pathname?.startsWith("/sign-") ||
    pathname?.startsWith("/chat/");

  return (
    <main
      className={cn(
        "pt-16 pb-16 lg:pb-0",
        !hideNavigation && "lg:pl-64"
      )}
    >
      {children}
    </main>
  );
}
