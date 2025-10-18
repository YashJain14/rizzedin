import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    clerkId: v.string(),
    linkedinUrl: v.optional(v.string()),
    age: v.number(),
    gender: v.string(), // "male", "female", "other"
    datingPreference: v.string(), // "men", "women", "both"
    onboardingCompleted: v.boolean(),

    // Fields added later from LinkedIn scraping
    name: v.optional(v.string()),
    image: v.optional(v.string()),
    bio: v.optional(v.string()),
    about: v.optional(v.string()),

    // LinkedIn experience (array of experience objects)
    experience: v.optional(v.array(v.object({
      title: v.string(),
      company: v.string(),
      companyUrl: v.optional(v.string()),
      companyLogo: v.optional(v.string()),
      location: v.optional(v.string()),
      startDate: v.string(), // e.g., "Jan 2020"
      endDate: v.optional(v.string()), // null if current position
      duration: v.optional(v.string()), // e.g., "2 yrs 3 mos"
      description: v.optional(v.string()),
      employmentType: v.optional(v.string()), // "Full-time", "Part-time", etc.
    }))),

    // LinkedIn education (array of education objects)
    education: v.optional(v.array(v.object({
      school: v.string(),
      schoolUrl: v.optional(v.string()),
      schoolLogo: v.optional(v.string()),
      degree: v.optional(v.string()), // e.g., "Bachelor's degree"
      fieldOfStudy: v.optional(v.string()), // e.g., "Computer Science"
      startDate: v.optional(v.string()),
      endDate: v.optional(v.string()),
      grade: v.optional(v.string()),
      activities: v.optional(v.string()),
      description: v.optional(v.string()),
    }))),

    // Dating app fields
    eloScore: v.optional(v.number()), // ELO rating based on right swipes received
    profileVector: v.optional(v.array(v.number())), // Vector embedding for similarity matching
    totalRightSwipes: v.optional(v.number()), // Total right swipes received
    totalLeftSwipes: v.optional(v.number()), // Total left swipes received
    matchCount: v.optional(v.number()), // Total matches

    timestamp: v.number(),
  })
    .index("by_clerk_id", ["clerkId"])
    .index("by_elo", ["eloScore"]),

  // Swipes table - tracks all swipe actions
  swipes: defineTable({
    swiperId: v.string(), // Clerk ID of person swiping
    swipedId: v.string(), // Clerk ID of person being swiped
    direction: v.string(), // "left" or "right"
    timestamp: v.number(),
  })
    .index("by_swiper", ["swiperId"])
    .index("by_swiped", ["swipedId"])
    .index("by_swiper_and_swiped", ["swiperId", "swipedId"]),

  // Matches table - created when both users swipe right
  matches: defineTable({
    user1Id: v.string(), // Clerk ID of first user
    user2Id: v.string(), // Clerk ID of second user
    timestamp: v.number(),
    chatStarted: v.optional(v.boolean()), // Has either user started chatting
  })
    .index("by_user1", ["user1Id"])
    .index("by_user2", ["user2Id"]),
});
