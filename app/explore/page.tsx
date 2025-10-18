"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Trophy, Briefcase, Loader2 } from "lucide-react";

export default function ExplorePage() {
  const leaderboard = useQuery(api.matches.getLeaderboard, { limit: 50 });

  if (!leaderboard) {
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
            <Trophy className="h-8 w-8 md:h-10 md:w-10 text-primary" />
            Leaderboard
          </h1>
          <p className="text-muted-foreground mt-2">
            Top professionals ranked by their ELO score
          </p>
        </div>

        {/* Leaderboard */}
        <div className="space-y-3">
          {leaderboard.map((user, index) => (
            <Card
              key={user.clerkId}
              className={`transition-all hover:shadow-lg ${
                index === 0
                  ? "border-2 border-primary"
                  : index === 1
                  ? "border-2 border-orange-500"
                  : index === 2
                  ? "border-2 border-amber-600"
                  : ""
              }`}
            >
              <CardContent className="p-4 md:p-6">
                <div className="flex items-start gap-4">
                  {/* Rank Badge */}
                  <div className="flex-shrink-0">
                    <div
                      className={`h-12 w-12 md:h-14 md:w-14 rounded-full flex items-center justify-center text-xl md:text-2xl font-bold ${
                        index === 0
                          ? "bg-gradient-to-br from-yellow-400 to-yellow-600 text-white"
                          : index === 1
                          ? "bg-gradient-to-br from-gray-300 to-gray-500 text-white"
                          : index === 2
                          ? "bg-gradient-to-br from-orange-400 to-orange-600 text-white"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {index + 1}
                    </div>
                  </div>

                  {/* Profile Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start gap-3 mb-3">
                      <Avatar className="h-12 w-12 md:h-14 md:w-14">
                        <AvatarImage src={user.image} alt={user.name} />
                        <AvatarFallback className="text-lg">
                          {user.name[0]?.toUpperCase()}
                        </AvatarFallback>
                      </Avatar>

                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-lg md:text-xl truncate">
                          {user.name}, {user.age}
                        </h3>
                        {user.bio && (
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {user.bio}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Experience */}
                    {user.experience && (
                      <div className="flex items-start gap-2 mb-3">
                        <Briefcase className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">
                            {user.experience.title}
                          </p>
                          <p className="text-sm text-muted-foreground truncate">
                            {user.experience.company}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Stats */}
                    <div className="flex flex-wrap gap-2">
                      <Badge
                        variant="secondary"
                        className={`${
                          index === 0
                            ? "bg-primary/10 text-primary"
                            : ""
                        }`}
                      >
                        ELO: {user.eloScore}
                      </Badge>
                      <Badge variant="outline">{user.gender}</Badge>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {leaderboard.length === 0 && (
          <Card>
            <CardContent className="pt-6 text-center">
              <p className="text-muted-foreground">No users on the leaderboard yet</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
