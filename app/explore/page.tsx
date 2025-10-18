"use client";

import { useState } from "react";
import { useQuery, useAction, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Trophy, Briefcase, Loader2, Users, Sparkles, ImagePlus, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useUser } from "@clerk/nextjs";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

export default function ExplorePage() {
  const router = useRouter();
  const { user } = useUser();
  const currentUser = useQuery(api.users.getUserByClerkId, user ? { clerkId: user.id } : "skip");
  const isAdmin = currentUser?.role && currentUser.role >= 2;

  const [showPersonas, setShowPersonas] = useState(false);
  const [generatingImageFor, setGeneratingImageFor] = useState<string | null>(null);
  const [startingChatWith, setStartingChatWith] = useState<string | null>(null);

  const leaderboard = useQuery(api.matches.getLeaderboard, {
    limit: 50,
    showPersonas,
  });

  const generatePersonaImage = useAction((api as any).bulkImport.generatePersonaImage);
  const getOrCreateChat = useMutation(api.aiChat.getOrCreateChat);

  const handleGenerateImage = async (clerkId: string, name: string) => {
    setGeneratingImageFor(clerkId);
    try {
      const result = await generatePersonaImage({ clerkId, name });
      if (result.success) {
        toast.success(`Image generated successfully for ${name}`);
      } else {
        toast.error(`Failed to generate image: ${result.error}`);
      }
    } catch (error) {
      toast.error("Failed to generate image");
      console.error(error);
    } finally {
      setGeneratingImageFor(null);
    }
  };

  const handleStartChat = async (targetClerkId: string, targetName: string) => {
    if (!user) return;

    setStartingChatWith(targetClerkId);
    try {
      // Create a unique chat ID for admins (allows multiple fresh chats with same person)
      const timestamp = Date.now();
      const chatId = `${user.id}-${targetClerkId}-${timestamp}`;

      // Create new chat with unique ID
      await getOrCreateChat({
        swiperId: user.id,
        swipedId: targetClerkId,
        chatId: chatId,
      });

      // Navigate to chat with unique ID
      router.push(`/chat/${chatId}`);
      toast.success(`Starting chat with ${targetName}`);
    } catch (error) {
      toast.error("Failed to start chat");
      console.error(error);
    } finally {
      setStartingChatWith(null);
    }
  };

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
                      <div className="relative">
                        <Avatar className="h-12 w-12 md:h-14 md:w-14">
                          <AvatarImage src={user.image} alt={user.name} />
                          <AvatarFallback className="text-lg">
                            {user.name[0]?.toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        {isAdmin && !user.image && (
                          <Button
                            size="sm"
                            variant="secondary"
                            className="absolute -bottom-1 -right-1 h-6 w-6 rounded-full p-0 shadow-md"
                            onClick={() => handleGenerateImage(user.clerkId, user.name)}
                            disabled={generatingImageFor === user.clerkId}
                            title="Generate AI image"
                          >
                            {generatingImageFor === user.clerkId ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <ImagePlus className="h-3 w-3" />
                            )}
                          </Button>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-lg md:text-xl truncate">
                          {user.name}, {user.age}
                        </h3>
                        {user.bio && (
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {user.bio}
                          </p>
                        )}
                        {isAdmin && !user.image && (
                          <p className="text-xs text-amber-600 mt-1">No image</p>
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
                    <div className="flex flex-wrap items-center gap-2">
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

                      {/* Admin: Start Chat Button */}
                      {isAdmin && user.clerkId !== currentUser?.clerkId && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="ml-auto flex items-center gap-1.5"
                          onClick={() => handleStartChat(user.clerkId, user.name)}
                          disabled={startingChatWith === user.clerkId}
                        >
                          {startingChatWith === user.clerkId ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <MessageCircle className="h-3.5 w-3.5" />
                          )}
                          <span className="text-xs">Start Chat</span>
                        </Button>
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
