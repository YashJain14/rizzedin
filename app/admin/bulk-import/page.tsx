"use client";

import { useState } from "react";
import { useAction, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, CheckCircle2, XCircle, ShieldAlert } from "lucide-react";
import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";

interface ImportResult {
  url: string;
  success: boolean;
  error?: string;
}

export default function BulkImportPage() {
  const { user } = useUser();
  const router = useRouter();
  const [linkedinUrls, setLinkedinUrls] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [results, setResults] = useState<ImportResult[]>([]);
  const [currentProgress, setCurrentProgress] = useState({ current: 0, total: 0 });

  const bulkImportUsers = useAction((api as any).bulkImport.bulkImportUsers);

  // Get current user's data to check role
  const currentUser = useQuery(
    api.users.getUserByClerkId,
    user ? { clerkId: user.id } : "skip"
  );

  // Check if user is admin (role 2) or superadmin (role 3)
  const isAdmin = currentUser?.role && currentUser.role >= 2;

  // Show access denied if not admin
  if (currentUser && !isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8">
        <Card className="max-w-md w-full">
          <CardHeader>
            <div className="flex items-center justify-center mb-4">
              <ShieldAlert className="h-16 w-16 text-destructive" />
            </div>
            <CardTitle className="text-center text-2xl">Access Denied</CardTitle>
            <CardDescription className="text-center">
              You do not have permission to access this page. This page is only available to administrators.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => router.push("/fyp")} className="w-full">
              Return to Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show loading while checking user role
  if (!currentUser) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);
    setResults([]);

    // Parse URLs from textarea (split by newlines, filter empty lines)
    const urls = linkedinUrls
      .split("\n")
      .map((url) => url.trim())
      .filter((url) => url.length > 0);

    if (urls.length === 0) {
      alert("Please enter at least one LinkedIn URL");
      setIsProcessing(false);
      return;
    }

    setCurrentProgress({ current: 0, total: urls.length });

    try {
      // Process URLs one by one to show progress
      const importResults: ImportResult[] = [];

      for (let i = 0; i < urls.length; i++) {
        const url = urls[i];
        setCurrentProgress({ current: i + 1, total: urls.length });

        try {
          const result = await bulkImportUsers({ linkedinUrl: url });
          importResults.push({
            url,
            success: result.success,
            error: result.error,
          });
        } catch (error) {
          importResults.push({
            url,
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
          });
        }
      }

      setResults(importResults);
    } catch (error) {
      alert("An error occurred during import");
      console.error(error);
    } finally {
      setIsProcessing(false);
    }
  };

  const successCount = results.filter((r) => r.success).length;
  const failureCount = results.filter((r) => !r.success).length;

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-3xl">Bulk User Import</CardTitle>
            <CardDescription>
              Import multiple users by pasting LinkedIn profile URLs (one per line)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="urls" className="text-sm font-medium">
                  LinkedIn Profile URLs
                </label>
                <Textarea
                  id="urls"
                  value={linkedinUrls}
                  onChange={(e) => setLinkedinUrls(e.target.value)}
                  placeholder="https://linkedin.com/in/user1&#10;https://linkedin.com/in/user2&#10;https://linkedin.com/in/user3"
                  className="min-h-[200px] font-mono text-sm"
                  disabled={isProcessing}
                />
                <p className="text-xs text-muted-foreground">
                  Enter one LinkedIn URL per line
                </p>
              </div>

              <Button
                type="submit"
                disabled={isProcessing || !linkedinUrls.trim()}
                className="w-full"
                size="lg"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing {currentProgress.current} of {currentProgress.total}...
                  </>
                ) : (
                  "Import Users"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Results Display */}
        {results.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Import Results</CardTitle>
              <CardDescription>
                {successCount} succeeded, {failureCount} failed
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {results.map((result, index) => (
                  <div
                    key={index}
                    className={`flex items-start gap-3 p-3 rounded-md border ${
                      result.success
                        ? "bg-green-50 border-green-200"
                        : "bg-red-50 border-red-200"
                    }`}
                  >
                    {result.success ? (
                      <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-mono break-all">{result.url}</p>
                      {result.error && (
                        <p className="text-xs text-red-600 mt-1">{result.error}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
