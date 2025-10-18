"use client";

import { useUser } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Heart, MessageCircle, Loader2, Sparkles } from "lucide-react";

export default function MatchesPage() {
  const { user } = useUser();

  const matches = useQuery(
    api.matches.getUserMatches,
    user?.id ? { clerkId: user.id } : "skip"
  );

  if (!matches) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <div className="container mx-auto p-4 md:p-8 max-w-6xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight flex items-center gap-3">
            <Heart className="h-8 w-8 md:h-10 md:w-10 text-primary fill-primary" />
            Your Matches
          </h1>
          <p className="text-muted-foreground mt-2">
            {matches.length} {matches.length === 1 ? "match" : "matches"}
          </p>
        </div>

        {/* Matches Grid */}
        {matches.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
            {matches.map((match) => (
              <Card
                key={match.matchId}
                className="overflow-hidden hover:shadow-lg transition-shadow"
              >
                <div className="relative h-48 md:h-56 bg-gradient-to-br from-primary/20 to-primary/5">
                  {match.user?.image ? (
                    <img
                      src={match.user.image}
                      alt={match.user.name || "Match"}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-5xl font-bold text-primary/20">
                      {match.user?.name?.[0]?.toUpperCase()}
                    </div>
                  )}
                  <div className="absolute top-3 right-3">
                    <Badge
                      variant="secondary"
                      className="bg-background/90 backdrop-blur"
                    >
                      <Sparkles className="h-3 w-3 mr-1" />
                      Match
                    </Badge>
                  </div>
                </div>

                <CardContent className="p-4 space-y-4">
                  {/* Profile Info */}
                  <div>
                    <h3 className="font-bold text-xl">
                      {match.user?.name}, {match.user?.age}
                    </h3>
                    {match.user?.bio && (
                      <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                        {match.user.bio}
                      </p>
                    )}
                    <Badge variant="outline" className="mt-2">
                      {match.user?.gender}
                    </Badge>
                  </div>

                  {/* Actions */}
                  <div className="space-y-2">
                    <Button className="w-full" size="sm" disabled>
                      <MessageCircle className="h-4 w-4 mr-2" />
                      Start Chat (Coming Soon)
                    </Button>
                    <p className="text-xs text-center text-muted-foreground">
                      Matched{" "}
                      {new Date(match.timestamp).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                      })}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="pt-6 text-center space-y-4">
              <div className="flex justify-center">
                <Heart className="h-16 w-16 text-muted-foreground/20" />
              </div>
              <div>
                <h2 className="text-xl font-semibold mb-2">No matches yet</h2>
                <p className="text-muted-foreground">
                  Start swiping to find your perfect professional match!
                </p>
              </div>
              <Button asChild>
                <a href="/fyp">Start Swiping</a>
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
