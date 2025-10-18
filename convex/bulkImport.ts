import { v } from "convex/values";
import { action, internalQuery, internalMutation, mutation, query } from "./_generated/server";
import { api } from "./_generated/api";
import { internal } from "./_generated/api";
import Groq from "groq-sdk";
import Exa from "exa-js";
import { GoogleGenAI } from "@google/genai";

// Initialize AI clients (lazy-loaded for environment variables)
// Note: In Convex, environment variables must be set in the dashboard
// and accessed via process.env in Node.js actions
function getGroqClient() {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error("GROQ_API_KEY environment variable is not set in Convex dashboard");
  }
  return new Groq({ apiKey });
}

function getExaClient() {
  const apiKey = process.env.EXASEARCH_API_KEY;
  if (!apiKey) {
    throw new Error("EXASEARCH_API_KEY environment variable is not set in Convex dashboard");
  }
  return new Exa(apiKey);
}

function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY environment variable is not set in Convex dashboard");
  }
  console.log("Initializing Gemini client with API key:", apiKey ? "present" : "missing");
  return new GoogleGenAI({ apiKey });
}

// Generate upload URL for image storage - internal mutation
export const generateUploadUrl = internalMutation({
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});

// Check if user with LinkedIn URL exists - internal query
export const checkLinkedInUrlExists = internalQuery({
  args: { linkedinUrl: v.string() },
  handler: async (ctx, args) => {
    const users = await ctx.db.query("users").collect();
    return users.some((u) => u.linkedinUrl === args.linkedinUrl);
  },
});

// Create user with LinkedIn URL - internal mutation
export const createBulkUser = internalMutation({
  args: {
    clerkId: v.string(),
    linkedinUrl: v.string(),
    age: v.number(),
    gender: v.string(),
    datingPreference: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await ctx.db.insert("users", {
      clerkId: args.clerkId,
      linkedinUrl: args.linkedinUrl,
      onboardingCompleted: false,
      age: args.age,
      gender: args.gender,
      datingPreference: args.datingPreference,
      role: 0, // Imported persona (practice account)
      eloScore: 1000,
      totalRightSwipes: 0,
      totalLeftSwipes: 0,
      matchCount: 0,
      timestamp: Date.now(),
    });
    return userId;
  },
});

// Helper function to generate a unique clerk ID for bulk imports
function generateBulkClerkId(linkedinUrl: string): string {
  // Extract username from LinkedIn URL and create a unique ID
  const urlMatch = linkedinUrl.match(/linkedin\.com\/in\/([^\/\?]+)/);
  const username = urlMatch?.[1] || Math.random().toString(36).substring(7);
  return `bulk_${username}_${Date.now()}`;
}

// Helper function to generate profile image using Gemini nanobanana
async function generateAndUploadProfileImage(
  ctx: any,
  name: string
): Promise<{ success: boolean; imageUrl?: string; error?: string }> {
  try {
    console.log(`Starting image generation for: ${name}`);
    const prompt = `Generate a realistic professional headshot portrait photo (shoulders and head) of ${name}. The image should look like a professional LinkedIn profile photo with good lighting and neutral background.`;

    // Use Gemini 2.5 Flash Image model (nanobanana)
    const genAI = getGeminiClient();
    console.log("Calling Gemini API...");

    const response = await genAI.models.generateContent({
      model: "gemini-2.5-flash-image",
      contents: prompt,
    });

    console.log("Gemini API response received:", JSON.stringify(response, null, 2));

    // Check if we have candidates
    if (!response.candidates || response.candidates.length === 0) {
      const error = "No candidates returned from Gemini API";
      console.error(error);
      return { success: false, error };
    }

    const candidate = response.candidates[0];
    if (!candidate.content || !candidate.content.parts) {
      const error = "No content parts in candidate";
      console.error(error);
      return { success: false, error };
    }

    // Look for inline image data
    let imageData: string | null = null;
    for (const part of candidate.content.parts) {
      console.log("Part type:", part);
      if (part.inlineData && part.inlineData.data) {
        imageData = part.inlineData.data;
        console.log("Found inline image data, length:", imageData.length);
        break;
      }
    }

    if (!imageData) {
      const error = "No inline image data found in response";
      console.error(error, "Response parts:", JSON.stringify(candidate.content.parts));
      return { success: false, error };
    }

    // Convert base64 to Uint8Array (Buffer doesn't exist in Convex runtime)
    console.log("Converting base64 to binary data...");
    // Decode base64 string to binary
    const binaryString = atob(imageData);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    console.log("Binary data size:", bytes.length);

    // Generate upload URL
    console.log("Generating upload URL...");
    const uploadUrl = await ctx.runMutation(internal.bulkImport.generateUploadUrl, {});
    console.log("Upload URL generated");

    // Upload the image to Convex storage
    console.log("Uploading to Convex storage...");
    const uploadResponse = await fetch(uploadUrl, {
      method: "POST",
      headers: { "Content-Type": "image/png" },
      body: bytes,
    });

    if (!uploadResponse.ok) {
      const error = `Failed to upload image: ${uploadResponse.status} ${uploadResponse.statusText}`;
      console.error(error);
      const responseText = await uploadResponse.text();
      console.error("Upload response:", responseText);
      return { success: false, error };
    }

    const uploadResult: any = await uploadResponse.json();
    const storageId = uploadResult.storageId;
    console.log("Image uploaded, storage ID:", storageId);

    // Get the public URL for the stored image
    const imageUrl = await ctx.storage.getUrl(storageId);
    console.log("Public URL obtained:", imageUrl);

    if (!imageUrl) {
      return { success: false, error: "Failed to get public URL for uploaded image" };
    }

    return { success: true, imageUrl };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error generating/uploading profile image:", error);
    console.error("Error stack:", error instanceof Error ? error.stack : "N/A");
    return { success: false, error: errorMessage };
  }
}

// Helper function to extract demographic info using Groq AI
async function extractDemographicInfo(profileText: string, name: string): Promise<{
  age: number;
  gender: string;
  datingPreference: string;
}> {
  try {
    const prompt = `Analyze this LinkedIn profile and extract demographic information. Be intelligent and make educated inferences based on the profile content.

Profile Name: ${name}
Profile Content: ${profileText}

Based on the profile information (graduation years, work history, name, etc.), provide:
1. Estimated age (as a number between 20-65)
2. Gender (male, female, or other) - infer from name and context
3. Dating preference (men, women, or both) - default to "both" if uncertain

Return ONLY a JSON object with this exact format:
{"age": 30, "gender": "male", "datingPreference": "both"}`;

    const groq = getGroqClient();
    const chatCompletion = await groq.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
      model: "llama-3.3-70b-versatile",
      temperature: 0.3, // Lower temperature for more consistent results
      max_tokens: 100,
    });

    const response = chatCompletion.choices[0]?.message?.content || "";

    // Extract JSON from response
    const jsonMatch = response.match(/\{[^}]+\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        age: parsed.age || 28,
        gender: parsed.gender || "other",
        datingPreference: parsed.datingPreference || "both",
      };
    }

    // Fallback to defaults if parsing fails
    throw new Error("Failed to parse AI response");
  } catch (error) {
    console.error("Error extracting demographic info with AI:", error);
    // Fallback to random but realistic defaults
    const genders = ["male", "female", "other"];
    const preferences = ["men", "women", "both"];
    return {
      age: Math.floor(Math.random() * (35 - 22 + 1)) + 22,
      gender: genders[Math.floor(Math.random() * genders.length)],
      datingPreference: preferences[Math.floor(Math.random() * preferences.length)],
    };
  }
}

// Bulk import users from LinkedIn URLs
// @ts-ignore - Circular reference is unavoidable due to Convex architecture
export const bulkImportUsers = action({
  args: {
    linkedinUrl: v.string(),
  },
  handler: async (ctx, args): Promise<{ success: boolean; error?: string; clerkId?: string; data?: any }> => {
    try {
      // Generate a unique clerk ID for this bulk import user
      const clerkId = generateBulkClerkId(args.linkedinUrl);

      // Check if user with this LinkedIn URL already exists
      const userExists = await ctx.runQuery(internal.bulkImport.checkLinkedInUrlExists, {
        linkedinUrl: args.linkedinUrl,
      });

      if (userExists) {
        return {
          success: false,
          error: "User with this LinkedIn URL already exists",
        };
      }

      // Fetch LinkedIn profile using Exa to get profile text and image
      const exa = getExaClient();
      const exaResult = await exa.getContents([args.linkedinUrl], { text: true });

      if (!exaResult.results || exaResult.results.length === 0) {
        return {
          success: false,
          error: "Failed to fetch LinkedIn profile from Exa",
        };
      }

      const profileData = exaResult.results[0];
      const profileText = profileData.text || "";
      let profileImage = profileData.image || undefined;
      const name = profileData.author || "Unknown";

      // If Exa didn't return an image, generate one using Gemini
      if (!profileImage) {
        console.log(`No image from Exa for ${name}, generating with Gemini...`);
        const generatedResult = await generateAndUploadProfileImage(ctx, name);
        if (generatedResult.success && generatedResult.imageUrl) {
          profileImage = generatedResult.imageUrl;
          console.log(`Successfully generated and uploaded image for ${name}`);
        } else {
          console.log(`Failed to generate image for ${name}: ${generatedResult.error}`);
        }
      }

      // Use AI to intelligently extract demographic information
      const demographics = await extractDemographicInfo(profileText, name);

      // Create user with AI-generated demographic data
      await ctx.runMutation(internal.bulkImport.createBulkUser, {
        clerkId,
        linkedinUrl: args.linkedinUrl,
        age: demographics.age,
        gender: demographics.gender,
        datingPreference: demographics.datingPreference,
      });

      // Scrape LinkedIn profile for full details (experience, education, etc.)
      const scrapeResult = await ctx.runAction((api as any).linkedinScraper.scrapeLinkedInProfile, {
        clerkId,
        linkedinUrl: args.linkedinUrl,
      });

      if (!scrapeResult.success) {
        return {
          success: false,
          error: `Failed to scrape LinkedIn details: ${scrapeResult.error}`,
        };
      }

      return {
        success: true,
        clerkId,
        data: {
          ...scrapeResult.data,
          demographics: {
            age: demographics.age,
            gender: demographics.gender,
            datingPreference: demographics.datingPreference,
            imageUrl: profileImage,
            imageSource: profileImage === profileData.image ? "exa" : "gemini-generated",
          },
        },
      };
    } catch (error) {
      console.error("Error in bulk import:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
});

// Get all personas (role === 0) for admin management
export const getAllPersonas = query({
  handler: async (ctx) => {
    const personas = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("role"), 0))
      .collect();

    return personas.map((persona) => ({
      _id: persona._id,
      clerkId: persona.clerkId,
      name: persona.name,
      image: persona.image,
      age: persona.age,
      gender: persona.gender,
      datingPreference: persona.datingPreference,
      linkedinUrl: persona.linkedinUrl,
      bio: persona.bio,
      eloScore: persona.eloScore,
      matchCount: persona.matchCount,
      onboardingCompleted: persona.onboardingCompleted,
    }));
  },
});

// Update persona details
export const updatePersona = mutation({
  args: {
    clerkId: v.string(),
    name: v.optional(v.string()),
    age: v.optional(v.number()),
    gender: v.optional(v.string()),
    datingPreference: v.optional(v.string()),
    bio: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { clerkId, ...updates } = args;

    // Find the persona by clerkId
    const persona = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("clerkId"), clerkId))
      .first();

    if (!persona) {
      throw new Error("Persona not found");
    }

    if (persona.role !== 0) {
      throw new Error("Can only update personas (role 0)");
    }

    // Update the persona
    await ctx.db.patch(persona._id, updates);

    return { success: true };
  },
});

// Delete persona
export const deletePersona = mutation({
  args: {
    clerkId: v.string(),
  },
  handler: async (ctx, args) => {
    // Find the persona by clerkId
    const persona = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("clerkId"), args.clerkId))
      .first();

    if (!persona) {
      throw new Error("Persona not found");
    }

    if (persona.role !== 0) {
      throw new Error("Can only delete personas (role 0)");
    }

    // Delete the persona
    await ctx.db.delete(persona._id);

    return { success: true };
  },
});

// Internal mutation to update persona image
export const updatePersonaImage = internalMutation({
  args: {
    clerkId: v.string(),
    imageUrl: v.string(),
  },
  handler: async (ctx, args) => {
    const persona = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("clerkId"), args.clerkId))
      .first();

    if (!persona) {
      throw new Error("Persona not found");
    }

    await ctx.db.patch(persona._id, { image: args.imageUrl });
    return { success: true };
  },
});

// Action to generate image for a persona
export const generatePersonaImage = action({
  args: {
    clerkId: v.string(),
    name: v.string(),
  },
  handler: async (ctx, args): Promise<{ success: boolean; imageUrl?: string; error?: string }> => {
    try {
      console.log(`generatePersonaImage called for: ${args.name} (${args.clerkId})`);

      const result = await generateAndUploadProfileImage(ctx, args.name);

      if (!result.success) {
        console.error(`Image generation failed: ${result.error}`);
        return {
          success: false,
          error: result.error || "Failed to generate image",
        };
      }

      if (!result.imageUrl) {
        return {
          success: false,
          error: "No image URL returned from generation",
        };
      }

      // Update the persona with the new image URL
      console.log(`Updating persona image in database...`);
      await ctx.runMutation(internal.bulkImport.updatePersonaImage, {
        clerkId: args.clerkId,
        imageUrl: result.imageUrl,
      });

      console.log(`Successfully updated persona image for ${args.name}`);
      return {
        success: true,
        imageUrl: result.imageUrl,
      };
    } catch (error) {
      console.error("Error generating persona image:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error("Error details:", errorMessage);
      return {
        success: false,
        error: errorMessage,
      };
    }
  },
});
