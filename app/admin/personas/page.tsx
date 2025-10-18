"use client";

import { useState } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useUser } from "@clerk/nextjs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Loader2, Edit, Trash2, Users, ExternalLink, UserPlus, CheckCircle2, XCircle, ImagePlus } from "lucide-react";
import { toast } from "sonner";

interface ImportResult {
  url: string;
  success: boolean;
  error?: string;
}

export default function PersonasManagementPage() {
  const { user } = useUser();
  const currentUser = useQuery(api.users.getUserByClerkId, user ? { clerkId: user.id } : "skip");
  const personas = useQuery(api.bulkImport.getAllPersonas);
  const updatePersona = useMutation(api.bulkImport.updatePersona);
  const deletePersona = useMutation(api.bulkImport.deletePersona);
  const bulkImportUsers = useAction((api as any).bulkImport.bulkImportUsers);
  const generatePersonaImage = useAction((api as any).bulkImport.generatePersonaImage);

  const [editingPersona, setEditingPersona] = useState<any>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [generatingImageFor, setGeneratingImageFor] = useState<string | null>(null);

  // Bulk import state
  const [isBulkImportOpen, setIsBulkImportOpen] = useState(false);
  const [linkedinUrls, setLinkedinUrls] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [importResults, setImportResults] = useState<ImportResult[]>([]);
  const [currentProgress, setCurrentProgress] = useState({ current: 0, total: 0 });

  // Access control
  const isAdmin = currentUser?.role && currentUser.role >= 2;

  if (!user || !currentUser) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>
              You need admin privileges to access persona management.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const handleBulkImport = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);
    setImportResults([]);

    const urls = linkedinUrls
      .split("\n")
      .map((url) => url.trim())
      .filter((url) => url.length > 0);

    if (urls.length === 0) {
      toast.error("Please enter at least one LinkedIn URL");
      setIsProcessing(false);
      return;
    }

    setCurrentProgress({ current: 0, total: urls.length });

    try {
      const results: ImportResult[] = [];

      for (let i = 0; i < urls.length; i++) {
        const url = urls[i];
        setCurrentProgress({ current: i + 1, total: urls.length });

        try {
          const result = await bulkImportUsers({ linkedinUrl: url });
          results.push({
            url,
            success: result.success,
            error: result.error,
          });
        } catch (error) {
          results.push({
            url,
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
          });
        }
      }

      setImportResults(results);
      const successCount = results.filter((r) => r.success).length;
      toast.success(`Imported ${successCount} of ${urls.length} personas successfully`);

      // Clear the textarea if all succeeded
      if (successCount === urls.length) {
        setLinkedinUrls("");
      }
    } catch (error) {
      toast.error("An error occurred during import");
      console.error(error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleEdit = (persona: any) => {
    setEditingPersona({
      clerkId: persona.clerkId,
      name: persona.name || "",
      age: persona.age || 0,
      gender: persona.gender || "",
      datingPreference: persona.datingPreference || "",
      bio: persona.bio || "",
    });
    setIsEditDialogOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editingPersona) return;

    try {
      await updatePersona({
        clerkId: editingPersona.clerkId,
        name: editingPersona.name,
        age: editingPersona.age,
        gender: editingPersona.gender,
        datingPreference: editingPersona.datingPreference,
        bio: editingPersona.bio,
      });
      toast.success("Persona updated successfully");
      setIsEditDialogOpen(false);
      setEditingPersona(null);
    } catch (error) {
      toast.error("Failed to update persona");
      console.error(error);
    }
  };

  const handleDelete = async (clerkId: string) => {
    setIsDeleting(true);
    try {
      await deletePersona({ clerkId });
      toast.success("Persona deleted successfully");
    } catch (error) {
      toast.error("Failed to delete persona");
      console.error(error);
    } finally {
      setIsDeleting(false);
    }
  };

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

  if (!personas) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const successCount = importResults.filter((r) => r.success).length;
  const failureCount = importResults.filter((r) => !r.success).length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <div className="container mx-auto p-4 md:p-8 max-w-7xl">
        {/* Header */}
        <div className="mb-8 flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight flex items-center gap-3">
              <Users className="h-8 w-8 md:h-10 md:w-10 text-primary" />
              Manage Personas
            </h1>
            <p className="text-muted-foreground mt-2">
              View, edit, and delete bulk imported practice personas
            </p>
            <div className="mt-4">
              <Badge variant="secondary" className="text-lg px-4 py-2">
                {personas.length} {personas.length === 1 ? "persona" : "personas"}
              </Badge>
            </div>
          </div>

          {/* Bulk Import Button */}
          <Dialog open={isBulkImportOpen} onOpenChange={setIsBulkImportOpen}>
            <DialogTrigger asChild>
              <Button size="lg" className="gap-2">
                <UserPlus className="h-5 w-5" />
                Bulk Import
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="text-2xl">Bulk Import Personas</DialogTitle>
                <DialogDescription>
                  Import multiple personas by pasting LinkedIn profile URLs (one per line)
                </DialogDescription>
              </DialogHeader>

              <form onSubmit={handleBulkImport} className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="urls">LinkedIn Profile URLs</Label>
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
                    "Import Personas"
                  )}
                </Button>
              </form>

              {/* Import Results */}
              {importResults.length > 0 && (
                <div className="mt-6 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold">Import Results</h3>
                    <Badge variant="secondary">
                      {successCount} succeeded, {failureCount} failed
                    </Badge>
                  </div>
                  <div className="space-y-2 max-h-[300px] overflow-y-auto">
                    {importResults.map((result: ImportResult, index: number) => (
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
                </div>
              )}
            </DialogContent>
          </Dialog>
        </div>

        {/* Personas Grid */}
        {personas.length === 0 ? (
          <Card>
            <CardContent className="pt-6 text-center">
              <p className="text-muted-foreground">
                No personas found. Use the bulk import page to add some!
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {personas.map((persona: any) => (
              <Card key={persona.clerkId} className="overflow-hidden">
                <CardContent className="p-6">
                  {/* Avatar and Name */}
                  <div className="flex items-start gap-4 mb-4">
                    <div className="relative">
                      <Avatar className="h-16 w-16">
                        <AvatarImage src={persona.image} alt={persona.name} />
                        <AvatarFallback className="text-xl">
                          {persona.name?.[0]?.toUpperCase() || "?"}
                        </AvatarFallback>
                      </Avatar>
                      {!persona.image && (
                        <Button
                          size="sm"
                          variant="secondary"
                          className="absolute -bottom-2 -right-2 h-8 w-8 rounded-full p-0"
                          onClick={() => handleGenerateImage(persona.clerkId, persona.name)}
                          disabled={generatingImageFor === persona.clerkId}
                          title="Generate AI image"
                        >
                          {generatingImageFor === persona.clerkId ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <ImagePlus className="h-4 w-4" />
                          )}
                        </Button>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-lg truncate">
                        {persona.name || "Unknown"}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        Age: {persona.age || "N/A"}
                      </p>
                      {!persona.image && (
                        <p className="text-xs text-amber-600 mt-1">No image</p>
                      )}
                    </div>
                  </div>

                  {/* Bio */}
                  {persona.bio && (
                    <p className="text-sm text-muted-foreground line-clamp-3 mb-4">
                      {persona.bio}
                    </p>
                  )}

                  {/* Stats */}
                  <div className="flex flex-wrap gap-2 mb-4">
                    <Badge variant="outline">{persona.gender || "N/A"}</Badge>
                    <Badge variant="outline">
                      Prefers: {persona.datingPreference || "N/A"}
                    </Badge>
                    <Badge variant="secondary">ELO: {persona.eloScore || 0}</Badge>
                  </div>

                  {/* LinkedIn URL */}
                  {persona.linkedinUrl && (
                    <a
                      href={persona.linkedinUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-sm text-primary hover:underline mb-4"
                    >
                      <ExternalLink className="h-4 w-4" />
                      LinkedIn Profile
                    </a>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2">
                    <Dialog open={isEditDialogOpen && editingPersona?.clerkId === persona.clerkId} onOpenChange={(open) => {
                      if (!open) {
                        setIsEditDialogOpen(false);
                        setEditingPersona(null);
                      }
                    }}>
                      <DialogTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          onClick={() => handleEdit(persona)}
                        >
                          <Edit className="h-4 w-4 mr-2" />
                          Edit
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
                        <DialogHeader>
                          <DialogTitle>Edit Persona</DialogTitle>
                          <DialogDescription>
                            Update the persona details below
                          </DialogDescription>
                        </DialogHeader>
                        {editingPersona && (
                          <div className="space-y-4 mt-4">
                            <div>
                              <Label htmlFor="name">Name</Label>
                              <Input
                                id="name"
                                value={editingPersona.name}
                                onChange={(e) =>
                                  setEditingPersona({ ...editingPersona, name: e.target.value })
                                }
                              />
                            </div>
                            <div>
                              <Label htmlFor="age">Age</Label>
                              <Input
                                id="age"
                                type="number"
                                value={editingPersona.age}
                                onChange={(e) =>
                                  setEditingPersona({
                                    ...editingPersona,
                                    age: parseInt(e.target.value) || 0,
                                  })
                                }
                              />
                            </div>
                            <div>
                              <Label htmlFor="gender">Gender</Label>
                              <Select
                                value={editingPersona.gender}
                                onValueChange={(value) =>
                                  setEditingPersona({ ...editingPersona, gender: value })
                                }
                              >
                                <SelectTrigger id="gender">
                                  <SelectValue placeholder="Select gender" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="male">Male</SelectItem>
                                  <SelectItem value="female">Female</SelectItem>
                                  <SelectItem value="other">Other</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <Label htmlFor="datingPreference">Dating Preference</Label>
                              <Select
                                value={editingPersona.datingPreference}
                                onValueChange={(value) =>
                                  setEditingPersona({
                                    ...editingPersona,
                                    datingPreference: value,
                                  })
                                }
                              >
                                <SelectTrigger id="datingPreference">
                                  <SelectValue placeholder="Select dating preference" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="men">Men</SelectItem>
                                  <SelectItem value="women">Women</SelectItem>
                                  <SelectItem value="both">Both</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <Label htmlFor="bio">Bio</Label>
                              <Textarea
                                id="bio"
                                value={editingPersona.bio}
                                onChange={(e) =>
                                  setEditingPersona({ ...editingPersona, bio: e.target.value })
                                }
                                rows={4}
                              />
                            </div>
                            <div className="flex gap-2 justify-end">
                              <Button
                                variant="outline"
                                onClick={() => {
                                  setIsEditDialogOpen(false);
                                  setEditingPersona(null);
                                }}
                              >
                                Cancel
                              </Button>
                              <Button onClick={handleSaveEdit}>Save Changes</Button>
                            </div>
                          </div>
                        )}
                      </DialogContent>
                    </Dialog>

                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="destructive" size="sm" disabled={isDeleting}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Persona</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to delete {persona.name}? This action cannot be
                            undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDelete(persona.clerkId)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
