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

// Calculate ELO rating change based on swipes (legacy - less weight)
export function calculateEloChangeFromSwipe(
  playerRating: number,
  opponentRating: number,
  actualScore: number, // 1 for win (right swipe received), 0 for loss (left swipe received)
  kFactor: number = 16 // Reduced K-factor, swipes matter less now
): number {
  const expectedScore = 1 / (1 + Math.pow(10, (opponentRating - playerRating) / 400));
  return Math.round(kFactor * (actualScore - expectedScore));
}

// Calculate ELO rating change based on AI conversation evaluation (primary factor)
export function calculateEloChangeFromConversation(
  userRating: number,
  partnerRating: number,
  rubricScore: number, // Overall score from rubric (1-10)
  kFactor: number = 48 // Higher K-factor, conversations matter MORE
): number {
  // Normalize rubric score to 0-1 range
  // 5 = neutral (expected), 10 = perfect (1.0), 1 = terrible (0.0)
  const normalizedScore = (rubricScore - 1) / 9; // Maps 1-10 to 0-1

  const expectedScore = 1 / (1 + Math.pow(10, (partnerRating - userRating) / 400));
  return Math.round(kFactor * (normalizedScore - expectedScore));
}

// Calculate comprehensive profile score (replaces simple ELO)
export function calculateProfileScore(user: {
  eloScore?: number;
  totalRightSwipes?: number;
  totalLeftSwipes?: number;
  conversationsCompleted?: number;
  aiApprovalsReceived?: number;
  aiRejectionsReceived?: number;
  avgRubricScores?: {
    engagement: number;
    depth: number;
    authenticity: number;
    respectfulness: number;
    compatibility: number;
    overall: number;
  };
  matchCount?: number;
  timestamp: number;
}): number {
  // 1. Conversation Quality Score (70% weight) - MOST IMPORTANT
  let conversationScore = 0;
  if (user.conversationsCompleted && user.conversationsCompleted > 0 && user.avgRubricScores) {
    // Weighted average of rubric scores
    const rubricScore =
      user.avgRubricScores.overall * 0.35 +      // Overall impression (35%)
      user.avgRubricScores.engagement * 0.25 +    // How engaged (25%)
      user.avgRubricScores.depth * 0.20 +         // Thoughtfulness (20%)
      user.avgRubricScores.authenticity * 0.10 +  // Genuine (10%)
      user.avgRubricScores.respectfulness * 0.10; // Appropriate (10%)

    // Normalize to 0-1 (assuming scores are 1-10)
    conversationScore = (rubricScore - 1) / 9;

    // Apply confidence penalty for low sample size
    const sampleSizeMultiplier = Math.min(user.conversationsCompleted / 5, 1); // Full confidence after 5 convos
    conversationScore *= sampleSizeMultiplier;
  }

  // 2. Swipe Appeal Score (20% weight) - Wilson score
  let swipeScore = 0;
  const totalSwipes = (user.totalRightSwipes || 0) + (user.totalLeftSwipes || 0);
  if (totalSwipes > 0) {
    swipeScore = calculateWilsonScore(user.totalRightSwipes || 0, totalSwipes);
  }

  // 3. Match Success Rate (10% weight)
  let matchScore = 0;
  if (user.conversationsCompleted && user.conversationsCompleted > 0) {
    matchScore = (user.matchCount || 0) / user.conversationsCompleted;
  }

  // 4. Recency Bonus (5% weight) - newer users get slight boost
  const daysSinceJoined = (Date.now() - user.timestamp) / (1000 * 60 * 60 * 24);
  const recencyScore = Math.max(0, 1 - daysSinceJoined / 60); // 60 day decay

  // Combine all factors
  const finalScore =
    conversationScore * 0.70 +
    swipeScore * 0.20 +
    matchScore * 0.05 +
    recencyScore * 0.05;

  // Scale to ELO-like range (800-1800)
  return Math.round(800 + (finalScore * 1000));
}

// Wilson score confidence interval for binomial proportion
function calculateWilsonScore(
  positiveCount: number,
  totalCount: number,
  confidence: number = 0.95
): number {
  if (totalCount === 0) return 0;

  const n = totalCount;
  const p = positiveCount / n;
  const z = 1.96; // 95% confidence

  const numerator = p + (z * z) / (2 * n) - z * Math.sqrt((p * (1 - p) + (z * z) / (4 * n)) / n);
  const denominator = 1 + (z * z) / n;

  return Math.max(0, numerator / denominator);
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
