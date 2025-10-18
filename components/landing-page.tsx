"use client";

import { SignInButton, SignUpButton } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Heart, Briefcase, Sparkles, Users, TrendingUp, Shield } from "lucide-react";

export function LandingPage() {
  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-primary/10 dark:from-primary/10 dark:via-background dark:to-primary/5" />

        <div className="relative container mx-auto px-4 py-16 md:py-24 lg:py-32">
          <div className="max-w-4xl mx-auto text-center space-y-8">
            {/* Badge */}
            <div className="flex justify-center">
              <Badge variant="secondary" className="px-4 py-2 text-sm font-medium">
                <Sparkles className="w-4 h-4 mr-2 inline" />
                LinkedIn for Rizzlers
              </Badge>
            </div>

            {/* Main Heading */}
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight">
              Where Professionals
              <br />
              <span className="bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                Find Their Match
              </span>
            </h1>

            {/* Subheading */}
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
              Connect with career-minded individuals who share your ambition.
              RizzedIn combines professional networking with meaningful dating.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
              <SignUpButton>
                <Button size="lg" className="text-lg px-8 h-12">
                  Get Started
                  <Heart className="ml-2 h-5 w-5" />
                </Button>
              </SignUpButton>
              <SignInButton>
                <Button size="lg" variant="outline" className="text-lg px-8 h-12">
                  Sign In
                </Button>
              </SignInButton>
            </div>

            {/* Stats or Trust Indicators */}
            <div className="flex flex-wrap justify-center gap-8 pt-8 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4" />
                <span>LinkedIn Verified</span>
              </div>
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                <span>Professional Network</span>
              </div>
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                <span>Career-Focused</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 md:py-24">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Why RizzedIn?
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Dating for professionals who value ambition, intelligence, and real connections
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {/* Feature 1 */}
            <Card className="border-2 hover:border-primary/50 transition-colors">
              <CardContent className="pt-6 space-y-4">
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Briefcase className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-xl font-semibold">LinkedIn Verified</h3>
                <p className="text-muted-foreground">
                  Connect through LinkedIn. Every profile is authentic, professional, and verified.
                </p>
              </CardContent>
            </Card>

            {/* Feature 2 */}
            <Card className="border-2 hover:border-primary/50 transition-colors">
              <CardContent className="pt-6 space-y-4">
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Heart className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-xl font-semibold">Career-Minded Matches</h3>
                <p className="text-muted-foreground">
                  Find someone who understands your ambitions and shares your drive for success.
                </p>
              </CardContent>
            </Card>

            {/* Feature 3 */}
            <Card className="border-2 hover:border-primary/50 transition-colors">
              <CardContent className="pt-6 space-y-4">
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Sparkles className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-xl font-semibold">Quality Over Quantity</h3>
                <p className="text-muted-foreground">
                  No endless swiping. Curated matches based on professional compatibility.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 md:py-24 bg-primary/5 dark:bg-primary/10">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center space-y-6">
            <h2 className="text-3xl md:text-4xl font-bold">
              Ready to Find Your Professional Match?
            </h2>
            <p className="text-lg text-muted-foreground">
              Join RizzedIn today and connect with ambitious professionals looking for meaningful relationships.
            </p>
            <div className="pt-4">
              <SignUpButton>
                <Button size="lg" className="text-lg px-8 h-12">
                  Get Started Now
                  <Heart className="ml-2 h-5 w-5" />
                </Button>
              </SignUpButton>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
