import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Get user by Clerk ID
export const getUserByClerkId = query({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .first();
    return user;
  },
});

// Create a new user
export const createUser = mutation({
  args: {
    clerkId: v.string(),
    linkedinUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existingUser = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .first();

    if (existingUser) {
      return existingUser._id;
    }

    const userId = await ctx.db.insert("users", {
      clerkId: args.clerkId,
      linkedinUrl: args.linkedinUrl,
      onboardingCompleted: false,
      age: 0, // Will be set during onboarding
      gender: "", // Will be set during onboarding
      datingPreference: "", // Will be set during onboarding
      timestamp: Date.now(),
    });

    return userId;
  },
});

// Complete user onboarding
export const completeOnboarding = mutation({
  args: {
    clerkId: v.string(),
    linkedinUrl: v.optional(v.string()),
    age: v.number(),
    gender: v.string(),
    datingPreference: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .first();

    if (!user) {
      throw new Error("User not found");
    }

    await ctx.db.patch(user._id, {
      linkedinUrl: args.linkedinUrl || user.linkedinUrl,
      age: args.age,
      gender: args.gender,
      datingPreference: args.datingPreference,
      onboardingCompleted: true,
    });

    return user._id;
  },
});

// Update user
export const updateUser = mutation({
  args: {
    clerkId: v.string(),
    linkedinUrl: v.optional(v.string()),
    age: v.optional(v.number()),
    gender: v.optional(v.string()),
    datingPreference: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .first();

    if (!user) {
      throw new Error("User not found");
    }

    const updates: any = {};
    if (args.linkedinUrl !== undefined) updates.linkedinUrl = args.linkedinUrl;
    if (args.age !== undefined) updates.age = args.age;
    if (args.gender !== undefined) updates.gender = args.gender;
    if (args.datingPreference !== undefined) updates.datingPreference = args.datingPreference;

    await ctx.db.patch(user._id, updates);

    return user._id;
  },
});
