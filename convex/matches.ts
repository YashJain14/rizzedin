import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

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

        // Determine which user is current user and which is other
        const isUser1 = match.user1Id === args.clerkId;

        return {
          matchId: match._id,
          timestamp: match.timestamp,
          user1Id: match.user1Id,
          user2Id: match.user2Id,

          // Approval status
          currentUserApproved: isUser1 ? match.user1Approved : match.user2Approved,
          otherUserApproved: isUser1 ? match.user2Approved : match.user1Approved,
          bothApproved: match.bothApproved || false,

          user: otherUser
            ? {
                clerkId: otherUser.clerkId,
                name: otherUser.name,
                image: otherUser.image,
                bio: otherUser.bio,
                age: otherUser.age,
                gender: otherUser.gender,
                linkedinUrl: match.bothApproved ? otherUser.linkedinUrl : undefined,
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
  args: {
    limit: v.optional(v.number()),
    showPersonas: v.optional(v.boolean()), // true = show imported personas (role 0), false = show real users (role >= 1)
  },
  handler: async (ctx, args) => {
    const limit = args.limit || 50;
    const showPersonas = args.showPersonas ?? false; // Default to showing real users

    const users = await ctx.db
      .query("users")
      .withIndex("by_elo")
      .order("desc")
      .take(limit);

    // Filter based on role and completed profiles
    return users
      .filter((u) => {
        if (!u.onboardingCompleted || !u.name) return false;

        // Filter by role based on showPersonas toggle
        if (showPersonas) {
          return u.role === 0; // Show only imported personas
        } else {
          return u.role >= 1; // Show real users (normal, admin, superadmin)
        }
      })
      .map((u) => ({
        clerkId: u.clerkId,
        name: u.name!,
        image: u.image,
        bio: u.bio,
        age: u.age,
        gender: u.gender,
        eloScore: u.eloScore || 1000,
        experience: u.experience?.[0], // Show most recent experience
        role: u.role, // Include role for debugging/display
      }));
  },
});

// Approve a match to share LinkedIn profile
export const approveMatch = mutation({
  args: {
    matchId: v.id("matches"),
    clerkId: v.string(),
  },
  handler: async (ctx, args) => {
    const match = await ctx.db.get(args.matchId);

    if (!match) {
      throw new Error("Match not found");
    }

    // Determine which user is approving
    const isUser1 = match.user1Id === args.clerkId;

    if (!isUser1 && match.user2Id !== args.clerkId) {
      throw new Error("Unauthorized");
    }

    // Update approval status
    if (isUser1) {
      await ctx.db.patch(args.matchId, {
        user1Approved: true,
        bothApproved: match.user2Approved === true,
      });
    } else {
      await ctx.db.patch(args.matchId, {
        user2Approved: true,
        bothApproved: match.user1Approved === true,
      });
    }

    return { success: true };
  },
});
