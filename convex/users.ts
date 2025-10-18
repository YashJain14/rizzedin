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

// Save onboarding data (but don't mark as complete yet - LinkedIn scraping will do that)
export const saveOnboardingData = mutation({
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
      // Don't set onboardingCompleted yet - will be set after LinkedIn scraping
    });

    return user._id;
  },
});

// Mark onboarding as complete (called after LinkedIn scraping)
export const markOnboardingComplete = mutation({
  args: {
    clerkId: v.string(),
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

// Update user profile with LinkedIn scraped data
export const updateUserProfile = mutation({
  args: {
    clerkId: v.string(),
    name: v.optional(v.string()),
    image: v.optional(v.string()),
    bio: v.optional(v.string()),
    about: v.optional(v.string()),
    experience: v.optional(v.array(v.object({
      title: v.string(),
      company: v.string(),
      companyUrl: v.optional(v.string()),
      companyLogo: v.optional(v.string()),
      location: v.optional(v.string()),
      startDate: v.string(),
      endDate: v.optional(v.string()),
      duration: v.optional(v.string()),
      description: v.optional(v.string()),
      employmentType: v.optional(v.string()),
    }))),
    education: v.optional(v.array(v.object({
      school: v.string(),
      schoolUrl: v.optional(v.string()),
      schoolLogo: v.optional(v.string()),
      degree: v.optional(v.string()),
      fieldOfStudy: v.optional(v.string()),
      startDate: v.optional(v.string()),
      endDate: v.optional(v.string()),
      grade: v.optional(v.string()),
      activities: v.optional(v.string()),
      description: v.optional(v.string()),
    }))),
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
    if (args.name !== undefined) updates.name = args.name;
    if (args.image !== undefined) updates.image = args.image;
    if (args.bio !== undefined) updates.bio = args.bio;
    if (args.about !== undefined) updates.about = args.about;
    if (args.experience !== undefined) updates.experience = args.experience;
    if (args.education !== undefined) updates.education = args.education;

    await ctx.db.patch(user._id, updates);

    return user._id;
  },
});
