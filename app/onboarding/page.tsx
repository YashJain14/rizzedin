"use client";

import { useUser } from "@clerk/nextjs";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function OnboardingPage() {
  const { user, isLoaded } = useUser();
  const router = useRouter();

  const existingUser = useQuery(
    api.users.getUserByClerkId,
    user?.id ? { clerkId: user.id } : "skip"
  );
  const createUser = useMutation(api.users.createUser);
  const completeOnboarding = useMutation(api.users.completeOnboarding);

  const [formData, setFormData] = useState({
    linkedinUrl: "",
    age: "",
    gender: "",
    datingPreference: "",
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    // If user data is loaded and onboarding is already completed, redirect to home
    if (existingUser && existingUser.onboardingCompleted) {
      router.push("/");
    }
  }, [existingUser, router]);

  useEffect(() => {
    // Create user in Convex when they first sign in
    if (user && !existingUser && existingUser !== undefined) {
      createUser({ clerkId: user.id });
    }
  }, [user, existingUser, createUser]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // Validation
    if (!formData.linkedinUrl.trim()) {
      setError("Please provide your LinkedIn profile URL");
      return;
    }

    if (!formData.age || parseInt(formData.age) < 18) {
      setError("You must be at least 18 years old");
      return;
    }

    if (!formData.gender) {
      setError("Please select your gender");
      return;
    }

    if (!formData.datingPreference) {
      setError("Please select your dating preference");
      return;
    }

    setIsSubmitting(true);

    try {
      await completeOnboarding({
        clerkId: user!.id,
        linkedinUrl: formData.linkedinUrl,
        age: parseInt(formData.age),
        gender: formData.gender,
        datingPreference: formData.datingPreference,
      });

      // Redirect to home after successful onboarding
      router.push("/");
    } catch (err) {
      setError("Something went wrong. Please try again.");
      setIsSubmitting(false);
    }
  };

  if (!isLoaded || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl">Welcome!</CardTitle>
          <CardDescription className="text-base">
            Let's set up your profile
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* LinkedIn URL */}
            <div className="space-y-2">
              <Label htmlFor="linkedinUrl">LinkedIn Profile URL *</Label>
              <Input
                type="url"
                id="linkedinUrl"
                value={formData.linkedinUrl}
                onChange={(e) =>
                  setFormData({ ...formData, linkedinUrl: e.target.value })
                }
                placeholder="https://linkedin.com/in/yourprofile"
                required
              />
            </div>

            {/* Age */}
            <div className="space-y-2">
              <Label htmlFor="age">Age *</Label>
              <Input
                type="number"
                id="age"
                value={formData.age}
                onChange={(e) =>
                  setFormData({ ...formData, age: e.target.value })
                }
                placeholder="18"
                min="18"
                max="100"
                required
              />
            </div>

            {/* Gender */}
            <div className="space-y-3">
              <Label>Gender *</Label>
              <RadioGroup
                value={formData.gender}
                onValueChange={(value) =>
                  setFormData({ ...formData, gender: value })
                }
                required
              >
                {["male", "female", "other"].map((option) => (
                  <div key={option} className="flex items-center space-x-2">
                    <RadioGroupItem value={option} id={`gender-${option}`} />
                    <Label
                      htmlFor={`gender-${option}`}
                      className="font-normal cursor-pointer capitalize"
                    >
                      {option}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </div>

            {/* Dating Preference */}
            <div className="space-y-3">
              <Label>Interested in *</Label>
              <RadioGroup
                value={formData.datingPreference}
                onValueChange={(value) =>
                  setFormData({ ...formData, datingPreference: value })
                }
                required
              >
                {["men", "women", "both"].map((option) => (
                  <div key={option} className="flex items-center space-x-2">
                    <RadioGroupItem value={option} id={`preference-${option}`} />
                    <Label
                      htmlFor={`preference-${option}`}
                      className="font-normal cursor-pointer capitalize"
                    >
                      {option}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </div>

            {error && (
              <div className="text-destructive text-sm text-center">{error}</div>
            )}

            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full"
              size="lg"
            >
              {isSubmitting ? "Completing..." : "Complete Profile"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
