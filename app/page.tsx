"use client";

import { useUser } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Sparkles, CheckCircle2 } from "lucide-react";
import { LandingPage } from "@/components/landing-page";

export default function Home() {
  const { user, isLoaded } = useUser();
  const router = useRouter();

  const existingUser = useQuery(
    api.users.getUserByClerkId,
    user?.id ? { clerkId: user.id } : "skip"
  );

  useEffect(() => {
    // Redirect to onboarding if user hasn't completed it
    if (isLoaded && user && existingUser !== undefined) {
      if (!existingUser || !existingUser.onboardingCompleted) {
        router.push("/onboarding");
      }
    }
  }, [isLoaded, user, existingUser, router]);

  // Show loading only when checking auth status
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

  // Show loading while fetching user data
  if (!existingUser) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-8 max-w-4xl">
      <div className="space-y-8">
        {/* Welcome Section */}
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold tracking-tight">Welcome to RizzedIn!</h1>
          <p className="text-lg text-muted-foreground">
            Your professional dating platform connecting career-minded individuals
          </p>
        </div>

        {/* Profile Card */}
        <Card>
          <CardHeader>
            <CardTitle>Your Profile</CardTitle>
            <CardDescription>Your onboarding is complete</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Age</p>
                <p className="text-lg">{existingUser.age} years old</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Gender</p>
                <p className="text-lg capitalize">{existingUser.gender}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Interested In</p>
                <p className="text-lg capitalize">{existingUser.datingPreference}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">LinkedIn</p>
                {existingUser.linkedinUrl ? (
                  <a
                    href={existingUser.linkedinUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-lg text-primary hover:underline"
                  >
                    View Profile
                  </a>
                ) : (
                  <p className="text-lg text-muted-foreground">Not provided</p>
                )}
              </div>
            </div>
            <div className="pt-4">
              <Badge variant="secondary">Profile Complete</Badge>
            </div>
          </CardContent>
        </Card>

        {/* LinkedIn Profile Data */}
        {existingUser.name && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                Professional Profile
              </CardTitle>
              <CardDescription>
                Your LinkedIn data has been automatically imported
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                <CheckCircle2 className="h-4 w-4" />
                <span>Profile enriched from LinkedIn</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {existingUser.name && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Name</p>
                    <p className="text-lg">{existingUser.name}</p>
                  </div>
                )}
                {existingUser.bio && (
                  <div className="md:col-span-2">
                    <p className="text-sm font-medium text-muted-foreground">Bio</p>
                    <p className="text-sm">{existingUser.bio}</p>
                  </div>
                )}
                {existingUser.experience && existingUser.experience.length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Work Experience</p>
                    <p className="text-lg">{existingUser.experience.length} positions</p>
                  </div>
                )}
                {existingUser.education && existingUser.education.length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Education</p>
                    <p className="text-lg">{existingUser.education.length} entries</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Coming Soon Section */}
        <Card>
          <CardHeader>
            <CardTitle>Coming Soon</CardTitle>
            <CardDescription>Features we're working on</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              <li className="flex items-center gap-2">
                <Badge variant="outline">Planned</Badge>
                Profile matching algorithm
              </li>
              <li className="flex items-center gap-2">
                <Badge variant="outline">Planned</Badge>
                Messaging & connections
              </li>
              <li className="flex items-center gap-2">
                <Badge variant="outline">Planned</Badge>
                Advanced search & filters
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
