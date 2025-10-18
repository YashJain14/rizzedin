"use client";

import { useUser } from "@clerk/nextjs";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Loader2, Save, Sparkles, User } from "lucide-react";
import { toast } from "sonner";

export default function ProfilePage() {
  const { user } = useUser();

  const currentUser = useQuery(
    api.users.getUserByClerkId,
    user?.id ? { clerkId: user.id } : "skip"
  );

  const updateAiPersonaPrompt = useMutation(api.users.updateAiPersonaPrompt);

  const [personaPrompt, setPersonaPrompt] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // Load current prompt when user data is available
  useEffect(() => {
    if (currentUser?.aiPersonaPrompt) {
      setPersonaPrompt(currentUser.aiPersonaPrompt);
    }
  }, [currentUser]);

  const handleSave = async () => {
    if (!user) return;

    setIsSaving(true);
    try {
      await updateAiPersonaPrompt({
        clerkId: user.id,
        aiPersonaPrompt: personaPrompt,
      });
      toast.success("AI Persona updated successfully!");
    } catch (error: any) {
      toast.error(error.message || "Failed to update AI Persona");
    } finally {
      setIsSaving(false);
    }
  };

  if (!currentUser) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <div className="container mx-auto p-4 md:p-8 max-w-4xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight flex items-center gap-3">
            <User className="h-8 w-8 md:h-10 md:w-10 text-primary" />
            Your Profile
          </h1>
          <p className="text-muted-foreground mt-2">
            Manage your AI persona and profile settings
          </p>
        </div>

        {/* Profile Info Card */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Profile Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-start gap-4">
              <Avatar className="h-20 w-20">
                <AvatarImage src={currentUser.image} alt={currentUser.name} />
                <AvatarFallback className="text-2xl">
                  {currentUser.name?.[0]?.toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <h3 className="text-2xl font-bold">{currentUser.name}</h3>
                {currentUser.bio && (
                  <p className="text-sm text-muted-foreground mt-1">{currentUser.bio}</p>
                )}
                <div className="flex gap-2 mt-3 flex-wrap">
                  <Badge variant="secondary">{currentUser.age} years old</Badge>
                  <Badge variant="outline">{currentUser.gender}</Badge>
                  <Badge variant="secondary">ELO: {currentUser.eloScore || 1000}</Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* AI Persona Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              <CardTitle>AI Persona Customization</CardTitle>
            </div>
            <CardDescription>
              Customize how your AI persona represents you when others chat with it after swiping right.
              Your profile information (name, bio, experience, education) is automatically included.
              Use this field to add personality traits, interests, communication style, or any other
              instructions for your AI.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">
                Additional Persona Instructions (Optional)
              </label>
              <Textarea
                value={personaPrompt}
                onChange={(e) => setPersonaPrompt(e.target.value)}
                placeholder="Example: I'm passionate about startups and technology. I prefer direct, honest communication and love discussing entrepreneurship. I enjoy hiking and playing guitar in my free time. Be witty and engaging, but don't be too forward."
                className="min-h-[200px]"
              />
              <p className="text-xs text-muted-foreground mt-2">
                {personaPrompt.length} characters
              </p>
            </div>

            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <h4 className="text-sm font-semibold flex items-center gap-2">
                <Sparkles className="h-4 w-4" />
                How it works
              </h4>
              <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
                <li>When someone swipes right on you, they chat with your AI persona</li>
                <li>The AI uses your profile info + these instructions to respond</li>
                <li>After 10 messages, the AI decides if you're a good match</li>
                <li>If approved, you'll both get a match notification</li>
                <li>Approve the match to share LinkedIn profiles with each other</li>
              </ul>
            </div>

            <Button
              onClick={handleSave}
              disabled={isSaving}
              className="w-full"
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save AI Persona
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
