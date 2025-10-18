"use client";

import { useUser } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { LandingPage } from "@/components/landing-page";

export default function Home() {
  const { user, isLoaded } = useUser();
  const router = useRouter();

  const existingUser = useQuery(
    api.users.getUserByClerkId,
    user?.id ? { clerkId: user.id } : "skip"
  );

  useEffect(() => {
    // Redirect authenticated users immediately
    if (isLoaded && user && existingUser !== undefined) {
      if (!existingUser || !existingUser.onboardingCompleted) {
        router.push("/onboarding");
      } else {
        router.push("/fyp");
      }
    }
  }, [isLoaded, user, existingUser, router]);

  // Show loading while checking auth status
  if (!isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Show landing page for logged-out users
  if (!user) {
    return <LandingPage />;
  }

  // Show loading for logged-in users while redirecting
  return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}
