"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Heart, Compass, Flame, User, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { useUser } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

const navItems = [
  {
    name: "For You",
    href: "/fyp",
    icon: Flame,
    adminOnly: false,
  },
  {
    name: "Explore",
    href: "/explore",
    icon: Compass,
    adminOnly: false,
  },
  {
    name: "Matches",
    href: "/matches",
    icon: Heart,
    adminOnly: false,
  },
  {
    name: "Profile",
    href: "/profile",
    icon: User,
    adminOnly: false,
  },
  {
    name: "Personas",
    href: "/admin/personas",
    icon: Users,
    adminOnly: true,
  },
];

export function Navigation() {
  const pathname = usePathname();
  const { user } = useUser();

  // Get current user's data to check role
  const currentUser = useQuery(
    api.users.getUserByClerkId,
    user ? { clerkId: user.id } : "skip"
  );

  // Don't show navigation on landing page, onboarding, sign-in/sign-up, or chat pages
  if (
    pathname === "/" ||
    pathname === "/onboarding" ||
    pathname?.startsWith("/sign-") ||
    pathname?.startsWith("/chat/")
  ) {
    return null;
  }

  // Check if on admin page for active state
  const isAdminActive = pathname?.startsWith("/admin/");

  // Check if user is admin (role 2) or superadmin (role 3)
  const isAdmin = currentUser?.role && currentUser.role >= 2;

  // Filter nav items based on user role
  const filteredNavItems = navItems.filter((item) => {
    if (item.adminOnly) {
      return isAdmin;
    }
    return true;
  });

  return (
    <>
      {/* Desktop Navigation - Sidebar */}
      <aside className="hidden lg:block fixed left-0 top-16 bottom-0 w-64 border-r bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 z-40">
        <nav className="p-6 space-y-2">
          {filteredNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = item.href.startsWith("/admin/")
              ? isAdminActive
              : pathname === item.href;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-lg transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-accent hover:text-accent-foreground"
                )}
              >
                <Icon className="h-5 w-5" />
                <span className="font-medium">{item.name}</span>
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Mobile Navigation - Bottom Bar */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 z-50">
        <div className="flex justify-around items-center h-16">
          {filteredNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = item.href.startsWith("/admin/")
              ? isAdminActive
              : pathname === item.href;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 px-4 py-2 rounded-lg transition-colors min-w-[80px]",
                  isActive
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className={cn("h-6 w-6", isActive && "fill-primary")} />
                <span className="text-xs font-medium">{item.name}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
