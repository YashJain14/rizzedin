"use client";

import { useUser } from "@clerk/nextjs";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Heart, X, Briefcase, GraduationCap, MapPin, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function FYPPage() {
  const { user } = useUser();
  const router = useRouter();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [isAboutExpanded, setIsAboutExpanded] = useState(false);

  const potentialMatches = useQuery(
    api.recommendations.getPersonalizedRecommendations,
    user?.id ? { clerkId: user.id, limit: 20 } : "skip"
  );

  const recordSwipe = useMutation(api.swipes.recordSwipe);
  const getOrCreateChat = useMutation(api.aiChat.getOrCreateChat);

  const currentProfile = potentialMatches?.[currentIndex];



  const handleSwipe = async (direction: "left" | "right") => {
    if (!user || !currentProfile || isAnimating) return;

    setIsAnimating(true);

    try {
      await recordSwipe({
        swiperId: user.id,
        swipedId: currentProfile.clerkId,
        direction,
      });

      if (direction === "right") {
        // Create chat before redirecting to ensure it exists
        const chatId = `${user.id}-${currentProfile.clerkId}`;
        await getOrCreateChat({
          swiperId: user.id,
          swipedId: currentProfile.clerkId,
          chatId,
        });

        // Redirect to AI chat page
        router.push(`/chat/${chatId}`);
      } else {
        // Move to next profile for left swipe
        setTimeout(() => {
          setCurrentIndex((prev) => prev + 1);
          setIsAnimating(false);
          setIsAboutExpanded(false);
        }, 300);
      }
    } catch (error) {
      toast.error("Failed to record swipe");
      setIsAnimating(false);
    }
  };

  if (!potentialMatches) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (potentialMatches.length === 0 || currentIndex >= potentialMatches.length || !currentProfile) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center space-y-4">
            <h2 className="text-2xl font-bold">No More Profiles</h2>
            <p className="text-muted-foreground">
              You've seen all available profiles. Check back later for new matches!
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background via-background to-primary/5">
      <div className="w-full max-w-2xl">
        {/* Profile Card */}
        <Card className="overflow-hidden">
    
          {/* Profile Section */}
          <CardContent className="relative pt-0 pb-6">
            {/* Profile Picture & Name */}
            <div className="flex items-start gap-6  mb-6">
              <div className="">
                <div className="h-32 w-32 rounded-full border-4 border-background bg-gradient-to-br from-primary/20 to-primary/5 overflow-hidden">
                  {currentProfile.image ? (
                    <img
                      src={currentProfile.image}
                      alt={currentProfile.name || "Profile"}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-4xl font-bold text-primary/40">
                      {currentProfile.name?.[0]?.toUpperCase()}
                      <div>
                      {currentProfile.bio?.[0]?.toUpperCase()}
                      
                    </div>
                    </div>
                    
                  )}
                </div>
              </div>

              <div className="flex-1 ">
                <h2 className="text-2xl md:text-3xl font-bold">
                  {currentProfile.name}
                </h2>
                {currentProfile.bio && (
                  <p className="text-muted-foreground mt-1 text-sm md:text-base">
                    {currentProfile.bio}
                  </p>
                )}
                <div className="flex gap-2 mt-3 flex-wrap">
                  <Badge variant="secondary">
                    {currentProfile.age} years old
                  </Badge>
                  <Badge variant="outline">{currentProfile.gender}</Badge>
                  <Badge variant="secondary">
                    ELO: {currentProfile.eloScore || 1000}
                  </Badge>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              {/* About */}
{currentProfile.about && (
  <div className="border-t pt-4">
    <h3 className="font-semibold text-lg mb-2">About</h3>
    <p className={`text-sm text-muted-foreground leading-relaxed ${isAboutExpanded ? '' : 'line-clamp-2'}`}>
      {currentProfile.about}
    </p>
    {currentProfile.about.length > 150 && (
      <button
        onClick={() => setIsAboutExpanded(!isAboutExpanded)}
        className="text-primary text-sm font-medium mt-1 hover:underline"
      >
        {isAboutExpanded ? 'Read less' : 'Read more'}
      </button>
    )}
  </div>
)}

              {/* Work Experience */}
              {currentProfile.experience && currentProfile.experience.length > 0 && (
                <div className="border-t pt-4">
                  <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                    <Briefcase className="h-5 w-5" />
                    Experience
                  </h3>
                  <div className="space-y-4">
                    {currentProfile.experience.slice(0, 3).map((exp: any, idx: number) => (
                      <div key={idx} className="flex gap-3">
                        {/* Company Logo */}
                        <div className="flex-shrink-0">
                          {exp.companyLogo ? (
                            <img
                              src={exp.companyLogo}
                              alt={exp.company}
                              className="h-12 w-12 rounded object-contain bg-muted p-1"
                            />
                          ) : (
                            <div className="h-12 w-12 rounded bg-muted flex items-center justify-center">
                              <Briefcase className="h-6 w-6 text-muted-foreground" />
                            </div>
                          )}
                        </div>

                        {/* Experience Details */}
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm md:text-base">{exp.title}</p>
                          <p className="text-sm text-muted-foreground">{exp.company}</p>
                          {exp.duration && (
                            <p className="text-xs text-muted-foreground mt-1">
                              {exp.duration}
                            </p>
                          )}
                          {exp.location && (
                            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                              <MapPin className="h-3 w-3" />
                              {exp.location}
                            </p>
                          )}
                          {exp.description && (
                            <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
                              {exp.description}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Education */}
              {currentProfile.education && currentProfile.education.length > 0 && (
                <div className="border-t pt-4">
                  <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                    <GraduationCap className="h-5 w-5" />
                    Education
                  </h3>
                  <div className="space-y-4">
                    {currentProfile.education.slice(0, 3).map((edu: any, idx: number) => (
                      <div key={idx} className="flex gap-3">
                        {/* School Logo */}
                        <div className="flex-shrink-0">
                          {edu.schoolLogo ? (
                            <img
                              src={edu.schoolLogo}
                              alt={edu.school}
                              className="h-12 w-12 rounded object-contain bg-muted p-1"
                            />
                          ) : (
                            <div className="h-12 w-12 rounded bg-muted flex items-center justify-center">
                              <GraduationCap className="h-6 w-6 text-muted-foreground" />
                            </div>
                          )}
                        </div>

                        {/* Education Details */}
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm md:text-base">{edu.school}</p>
                          {edu.degree && (
                            <p className="text-sm text-muted-foreground">{edu.degree}</p>
                          )}
                          {edu.fieldOfStudy && (
                            <p className="text-xs text-muted-foreground">
                              {edu.fieldOfStudy}
                            </p>
                          )}
                          {(edu.startDate || edu.endDate) && (
                            <p className="text-xs text-muted-foreground mt-1">
                              {edu.startDate} {edu.endDate && `- ${edu.endDate}`}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Swipe Buttons */}
        <div className="flex justify-center gap-6 mt-6">
          <Button
            size="lg"
            variant="outline"
            className="h-16 w-16 rounded-full"
            onClick={() => handleSwipe("left")}
            disabled={isAnimating}
          >
            <X className="h-8 w-8 text-destructive" />
          </Button>
          <Button
            size="lg"
            className="h-16 w-16 rounded-full bg-primary hover:bg-primary/90"
            onClick={() => handleSwipe("right")}
            disabled={isAnimating}
          >
            <Heart className="h-8 w-8" />
          </Button>
        </div>

        {/* Progress */}
        <p className="text-center text-sm text-muted-foreground mt-4">
          {currentIndex + 1} / {potentialMatches.length}
        </p>
      </div>
    </div>
  );
}
