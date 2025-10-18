import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

// Calculate cosine similarity between two vectors
function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (!vecA || !vecB || vecA.length !== vecB.length) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
  return magnitude === 0 ? 0 : dotProduct / magnitude;
}

// Generate a simple profile embedding vector
export function generateProfileVector(user: {
  age: number;
  gender: string;
  bio?: string;
  about?: string;
  experience?: Array<{ title: string; company: string; duration?: string }>;
  education?: Array<{ school: string; degree?: string; fieldOfStudy?: string }>;
}): number[] {
  const vector: number[] = [];

  // Age normalization (18-100 range)
  vector.push((user.age - 18) / 82);

  // Gender encoding (one-hot)
  vector.push(user.gender === "male" ? 1 : 0);
  vector.push(user.gender === "female" ? 1 : 0);
  vector.push(user.gender === "other" ? 1 : 0);

  // Text length features (normalized)
  vector.push(user.bio ? Math.min(user.bio.length / 200, 1) : 0);
  vector.push(user.about ? Math.min(user.about.length / 500, 1) : 0);

  // Experience features
  const expCount = user.experience?.length || 0;
  vector.push(Math.min(expCount / 5, 1)); // Normalize to 5 experiences

  // Calculate average experience duration (in months, normalized)
  let avgDuration = 0;
  if (user.experience && user.experience.length > 0) {
    const durations = user.experience
      .map((exp) => {
        if (!exp.duration) return 0;
        // Parse duration like "2 yrs 3 mos" or "6 mos"
        const years = exp.duration.match(/(\d+)\s*yr/);
        const months = exp.duration.match(/(\d+)\s*mo/);
        return (years ? parseInt(years[1]) * 12 : 0) + (months ? parseInt(months[1]) : 0);
      })
      .filter((d) => d > 0);

    avgDuration = durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0;
  }
  vector.push(Math.min(avgDuration / 60, 1)); // Normalize to 5 years (60 months)

  // Education features
  const eduCount = user.education?.length || 0;
  vector.push(Math.min(eduCount / 3, 1)); // Normalize to 3 education entries

  // Has degree
  const hasDegree = user.education?.some((edu) => edu.degree) ? 1 : 0;
  vector.push(hasDegree);

  // Has field of study
  const hasField = user.education?.some((edu) => edu.fieldOfStudy) ? 1 : 0;
  vector.push(hasField);

  return vector;
}

// Calculate ELO rating change
export function calculateEloChange(
  playerRating: number,
  opponentRating: number,
  actualScore: number, // 1 for win (right swipe received), 0 for loss (left swipe received)
  kFactor: number = 32
): number {
  const expectedScore = 1 / (1 + Math.pow(10, (opponentRating - playerRating) / 400));
  return Math.round(kFactor * (actualScore - expectedScore));
}

// Get personalized recommendations with vector similarity
export const getPersonalizedRecommendations = query({
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

    // Get all potential matches
    const allUsers = await ctx.db.query("users").collect();

    // Filter and score users
    const scoredUsers = allUsers
      .filter((user) => {
        // Skip self
        if (user.clerkId === args.clerkId) return false;

        // Skip already swiped
        if (swipedIds.has(user.clerkId)) return false;

        // Skip incomplete profiles
        if (!user.onboardingCompleted || !user.name) return false;

        // Filter by dating preference (mutual interest required)
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
      })
      .map((user) => {
        // Calculate similarity score
        let similarityScore = 0;

        // Vector similarity (if both users have profile vectors)
        if (currentUser.profileVector && user.profileVector) {
          const vectorSimilarity = cosineSimilarity(currentUser.profileVector, user.profileVector);
          similarityScore += vectorSimilarity * 0.4; // 40% weight
        }

        // ELO-based score (prefer users with similar or higher ELO)
        const currentElo = currentUser.eloScore || 1000;
        const userElo = user.eloScore || 1000;
        const eloDiff = Math.abs(currentElo - userElo);
        const eloScore = Math.max(0, 1 - eloDiff / 1000); // Normalize
        similarityScore += eloScore * 0.2; // 20% weight

        // Popularity score (users with more right swipes)
        const popularity = (user.totalRightSwipes || 0) / Math.max((user.totalRightSwipes || 0) + (user.totalLeftSwipes || 0), 1);
        similarityScore += popularity * 0.2; // 20% weight

        // Recency bonus (newer users get a boost)
        const daysSinceJoined = (Date.now() - user.timestamp) / (1000 * 60 * 60 * 24);
        const recencyScore = Math.max(0, 1 - daysSinceJoined / 30); // 30 day decay
        similarityScore += recencyScore * 0.1; // 10% weight

        // Random factor for diversity
        similarityScore += Math.random() * 0.1; // 10% weight

        return {
          user,
          score: similarityScore,
        };
      });

    // Sort by score and return top matches
    return scoredUsers
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((item) => item.user);
  },
});

// Update user profile vector
export const updateProfileVector = mutation({
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

    // Generate profile vector
    const vector = generateProfileVector({
      age: user.age,
      gender: user.gender,
      bio: user.bio,
      about: user.about,
      experience: user.experience,
      education: user.education,
    });

    // Update user with vector
    await ctx.db.patch(user._id, {
      profileVector: vector,
    });

    return user._id;
  },
});
