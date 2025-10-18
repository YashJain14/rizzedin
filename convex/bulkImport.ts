import { v } from "convex/values";
import { action, internalQuery, internalMutation } from "./_generated/server";
import { api } from "./_generated/api";
import { internal } from "./_generated/api";
import Groq from "groq-sdk";
import Exa from "exa-js";

// Initialize AI clients
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const exa = new Exa(process.env.EXASEARCH_API_KEY);

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
      const exaResult = await exa.getContents([args.linkedinUrl], { text: true });

      if (!exaResult.results || exaResult.results.length === 0) {
        return {
          success: false,
          error: "Failed to fetch LinkedIn profile from Exa",
        };
      }

      const profileData = exaResult.results[0];
      const profileText = profileData.text || "";
      const profileImage = profileData.image || undefined;
      const name = profileData.author || "Unknown";

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
