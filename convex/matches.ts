import { v } from "convex/values";
import { query } from "./_generated/server";

// Get all matches for a user
export const getUserMatches = query({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    // Find matches where user is either user1 or user2
    const matchesAsUser1 = await ctx.db
      .query("matches")
      .withIndex("by_user1", (q) => q.eq("user1Id", args.clerkId))
      .collect();

    const matchesAsUser2 = await ctx.db
      .query("matches")
      .withIndex("by_user2", (q) => q.eq("user2Id", args.clerkId))
      .collect();

    const allMatches = [...matchesAsUser1, ...matchesAsUser2];

    // Get user details for each match
    const matchesWithDetails = await Promise.all(
      allMatches.map(async (match) => {
        const otherUserId =
          match.user1Id === args.clerkId ? match.user2Id : match.user1Id;

        const otherUser = await ctx.db
          .query("users")
          .withIndex("by_clerk_id", (q) => q.eq("clerkId", otherUserId))
          .first();

        return {
          matchId: match._id,
          timestamp: match.timestamp,
          chatStarted: match.chatStarted || false,
          user: otherUser
            ? {
                clerkId: otherUser.clerkId,
                name: otherUser.name,
                image: otherUser.image,
                bio: otherUser.bio,
                age: otherUser.age,
                gender: otherUser.gender,
              }
            : null,
        };
      })
    );

    // Filter out matches where user was deleted and sort by timestamp
    return matchesWithDetails
      .filter((m) => m.user !== null)
      .sort((a, b) => b.timestamp - a.timestamp);
  },
});

// Get ELO leaderboard
export const getLeaderboard = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const limit = args.limit || 50;

    const users = await ctx.db
      .query("users")
      .withIndex("by_elo")
      .order("desc")
      .take(limit);

    // Filter only completed profiles with names
    return users
      .filter((u) => u.onboardingCompleted && u.name)
      .map((u) => ({
        clerkId: u.clerkId,
        name: u.name!,
        image: u.image,
        bio: u.bio,
        age: u.age,
        gender: u.gender,
        eloScore: u.eloScore || 1000,
        experience: u.experience?.[0], // Show most recent experience
      }));
  },
});
