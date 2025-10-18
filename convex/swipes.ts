import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { calculateEloChange } from "./recommendations";

// Record a swipe action with proper ELO calculation
export const recordSwipe = mutation({
  args: {
    swiperId: v.string(),
    swipedId: v.string(),
    direction: v.string(), // "left" or "right"
  },
  handler: async (ctx, args) => {
    // Check if already swiped
    const existingSwipe = await ctx.db
      .query("swipes")
      .withIndex("by_swiper_and_swiped", (q) =>
        q.eq("swiperId", args.swiperId).eq("swipedId", args.swipedId)
      )
      .first();

    if (existingSwipe) {
      // Update existing swipe
      await ctx.db.patch(existingSwipe._id, {
        direction: args.direction,
        timestamp: Date.now(),
      });
      return existingSwipe._id;
    }

    // Create new swipe
    const swipeId = await ctx.db.insert("swipes", {
      swiperId: args.swiperId,
      swipedId: args.swipedId,
      direction: args.direction,
      timestamp: Date.now(),
    });

    // Get both users
    const swiper = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.swiperId))
      .first();

    const swipedUser = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.swipedId))
      .first();

    if (!swiper || !swipedUser) {
      return swipeId;
    }

    // Update swipe counts and ELO based on direction
    if (args.direction === "right") {
      // Update swiped user's stats (they received a right swipe)
      const swiperElo = swiper.eloScore || 1000;
      const swipedElo = swipedUser.eloScore || 1000;

      // Calculate ELO change (swiper is rating swipedUser positively)
      const eloChange = calculateEloChange(swipedElo, swiperElo, 1); // 1 = win (got right swipe)

      await ctx.db.patch(swipedUser._id, {
        eloScore: swipedElo + eloChange,
        totalRightSwipes: (swipedUser.totalRightSwipes || 0) + 1,
      });

      // Note: Matches are no longer created automatically on mutual right swipes
      // Instead, the swiper will chat with the AI persona of the swiped user
      // A match is only created if the AI approves after 10 messages
    } else {
      // Left swipe - update left swipe count
      await ctx.db.patch(swipedUser._id, {
        totalLeftSwipes: (swipedUser.totalLeftSwipes || 0) + 1,
      });

      // Small ELO penalty for left swipes
      const swiperElo = swiper.eloScore || 1000;
      const swipedElo = swipedUser.eloScore || 1000;
      const eloChange = calculateEloChange(swipedElo, swiperElo, 0, 16); // 0 = loss, smaller K-factor

      await ctx.db.patch(swipedUser._id, {
        eloScore: Math.max(100, swipedElo + eloChange), // Min ELO of 100
      });
    }

    return swipeId;
  },
});

// Get users already swiped by this user
export const getSwipedUsers = query({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    const swipes = await ctx.db
      .query("swipes")
      .withIndex("by_swiper", (q) => q.eq("swiperId", args.clerkId))
      .collect();

    return swipes.map((s) => s.swipedId);
  },
});

// Get potential matches for FYP (filtered by preferences, not already swiped)
export const getPotentialMatches = query({
  args: {
    clerkId: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit || 20;

    // Get current user
    const currentUser = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .first();

    if (!currentUser || !currentUser.onboardingCompleted) {
      return [];
    }

    // Get already swiped users
    const swipedUsers = await ctx.db
      .query("swipes")
      .withIndex("by_swiper", (q) => q.eq("swiperId", args.clerkId))
      .collect();

    const swipedIds = new Set(swipedUsers.map((s) => s.swipedId));

    // Get all users who match preferences
    const allUsers = await ctx.db.query("users").collect();

    const potentialMatches = allUsers.filter((user) => {
      // Skip self
      if (user.clerkId === args.clerkId) return false;

      // Skip already swiped
      if (swipedIds.has(user.clerkId)) return false;

      // Skip incomplete profiles
      if (!user.onboardingCompleted || !user.name) return false;

      // Filter by dating preference
      const currentUserPref = currentUser.datingPreference;
      const otherUserGender = user.gender;

      let matchesPreference = false;

      if (currentUserPref === "both") {
        matchesPreference = true;
      } else if (currentUserPref === "men" && otherUserGender === "male") {
        matchesPreference = true;
      } else if (currentUserPref === "women" && otherUserGender === "female") {
        matchesPreference = true;
      }

      if (!matchesPreference) return false;

      // Check if other user is interested in current user's gender
      const otherUserPref = user.datingPreference;
      const currentUserGender = currentUser.gender;

      let mutualInterest = false;

      if (otherUserPref === "both") {
        mutualInterest = true;
      } else if (otherUserPref === "men" && currentUserGender === "male") {
        mutualInterest = true;
      } else if (otherUserPref === "women" && currentUserGender === "female") {
        mutualInterest = true;
      }

      return mutualInterest;
    });

    // Sort by ELO (higher first) and return limited results
    return potentialMatches
      .sort((a, b) => (b.eloScore || 1000) - (a.eloScore || 1000))
      .slice(0, limit);
  },
});
