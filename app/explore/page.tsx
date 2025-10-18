"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Trophy, Briefcase, Loader2, Users, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

export default function ExplorePage() {
  const [showPersonas, setShowPersonas] = useState(false);
  const leaderboard = useQuery(api.matches.getLeaderboard, {
    limit: 50,
    showPersonas,
  });

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
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold tracking-tight flex items-center gap-3">
                <Trophy className="h-8 w-8 md:h-10 md:w-10 text-primary" />
                Leaderboard
              </h1>
              <p className="text-muted-foreground mt-2">
                {showPersonas
                  ? "Practice with famous personas"
                  : "Top professionals ranked by their ELO score"}
              </p>
            </div>

            {/* Toggle between real users and personas */}
            <div className="flex gap-2 bg-muted p-1 rounded-lg">
              <Button
                variant={!showPersonas ? "default" : "ghost"}
                size="sm"
                onClick={() => setShowPersonas(false)}
                className={cn(
                  "flex items-center gap-2 transition-all",
                  !showPersonas && "shadow-sm"
                )}
              >
                <Users className="h-4 w-4" />
                <span className="hidden sm:inline">Real Users</span>
              </Button>
              <Button
                variant={showPersonas ? "default" : "ghost"}
                size="sm"
                onClick={() => setShowPersonas(true)}
                className={cn(
                  "flex items-center gap-2 transition-all",
                  showPersonas && "shadow-sm"
                )}
              >
                <Sparkles className="h-4 w-4" />
                <span className="hidden sm:inline">Practice Personas</span>
              </Button>
            </div>
          </div>
        </div>

        {/* Leaderboard */}
        <div className="space-y-3">
          {leaderboard.map((user: any, index: number) => (
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
                      {user.role === 0 && (
                        <Badge variant="secondary" className="bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300">
                          <Sparkles className="h-3 w-3 mr-1" />
                          Persona
                        </Badge>
                      )}
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
              <p className="text-muted-foreground">
                {showPersonas
                  ? "No practice personas available yet. Use the admin panel to import some!"
                  : "No users on the leaderboard yet"}
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
