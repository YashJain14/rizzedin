import { v } from "convex/values";
import { mutation, query, action, internalMutation } from "./_generated/server";
import { api } from "./_generated/api";
import { internal } from "./_generated/api";
import Groq from "groq-sdk";
import { calculateEloChangeFromConversation } from "./recommendations";

// Initialize Groq client
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// Get or create AI chat
export const getOrCreateChat = mutation({
  args: {
    swiperId: v.string(),
    swipedId: v.string(),
    chatId: v.optional(v.string()), // Optional: allows creating new chats with unique IDs
  },
  handler: async (ctx, args) => {
    const chatId = args.chatId || `${args.swiperId}-${args.swipedId}`;

    // Check if chat exists
    const existingChat = await ctx.db
      .query("aiChats")
      .withIndex("by_chat_id", (q) => q.eq("chatId", chatId))
      .first();

    if (existingChat) {
      return existingChat;
    }

    // Create new chat
    const newChatId = await ctx.db.insert("aiChats", {
      chatId,
      swiperId: args.swiperId,
      swipedId: args.swipedId,
      messages: [],
      messageCount: 0,
      timestamp: Date.now(),
    });

    const newChat = await ctx.db.get(newChatId);
    return newChat;
  },
});

// Get chat by ID
export const getChat = query({
  args: { chatId: v.string() },
  handler: async (ctx, args) => {
    const chat = await ctx.db
      .query("aiChats")
      .withIndex("by_chat_id", (q) => q.eq("chatId", args.chatId))
      .first();

    return chat;
  },
});

// Get all chats for a user (where they're swiping)
export const getUserChats = query({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    const chats = await ctx.db
      .query("aiChats")
      .withIndex("by_swiper", (q) => q.eq("swiperId", args.clerkId))
      .collect();

    // Get user details for each chat
    const chatsWithDetails = await Promise.all(
      chats.map(async (chat) => {
        const swipedUser = await ctx.db
          .query("users")
          .withIndex("by_clerk_id", (q) => q.eq("clerkId", chat.swipedId))
          .first();

        return {
          ...chat,
          swipedUser: swipedUser
            ? {
                clerkId: swipedUser.clerkId,
                name: swipedUser.name,
                image: swipedUser.image,
                bio: swipedUser.bio,
              }
            : null,
        };
      })
    );

    return chatsWithDetails.sort((a, b) => b.timestamp - a.timestamp);
  },
});

// Mutation to add message to chat
export const addMessageToChat = mutation({
  args: {
    chatId: v.string(),
    role: v.string(),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    const chat = await ctx.db
      .query("aiChats")
      .withIndex("by_chat_id", (q) => q.eq("chatId", args.chatId))
      .first();

    if (!chat) {
      throw new Error("Chat not found");
    }

    const newMessage = {
      role: args.role,
      content: args.content,
      timestamp: Date.now(),
    };

    const updatedMessages = [...chat.messages, newMessage];
    const newMessageCount = args.role === "user" ? chat.messageCount + 1 : chat.messageCount;

    await ctx.db.patch(chat._id, {
      messages: updatedMessages,
      messageCount: newMessageCount,
    });

    return { messageCount: newMessageCount };
  },
});

// Mutation to set AI decision
export const setAiDecision = mutation({
  args: {
    chatId: v.string(),
    decision: v.string(),
    reasoning: v.string(),
    rubric: v.object({
      engagement: v.number(),
      depth: v.number(),
      authenticity: v.number(),
      respectfulness: v.number(),
      compatibility: v.number(),
      overall: v.number(),
    }),
  },
  handler: async (ctx, args) => {
    const chat = await ctx.db
      .query("aiChats")
      .withIndex("by_chat_id", (q) => q.eq("chatId", args.chatId))
      .first();

    if (!chat) {
      throw new Error("Chat not found");
    }

    await ctx.db.patch(chat._id, {
      aiDecision: args.decision,
      aiReasoning: args.reasoning,
      aiRubric: args.rubric,
    });
  },
});

// Generate AI persona system prompt
function generatePersonaPrompt(user: any, customPrompt?: string): string {
  const basePrompt = `You are an AI persona representing ${user.name || "a professional"} on a dating app called RizzedIn.

Your profile details:
- Name: ${user.name || "Unknown"}
- Age: ${user.age}
- Bio: ${user.bio || "No bio available"}
- About: ${user.about || "No detailed about section"}

${user.experience && user.experience.length > 0 ? `Work Experience:
${user.experience.slice(0, 2).map((exp: any) => `- ${exp.title} at ${exp.company}${exp.duration ? ` (${exp.duration})` : ''}`).join('\n')}` : ''}

${user.education && user.education.length > 0 ? `Education:
${user.education.slice(0, 2).map((edu: any) => `- ${edu.degree || 'Studied'} at ${edu.school}${edu.fieldOfStudy ? ` (${edu.fieldOfStudy})` : ''}`).join('\n')}` : ''}

${customPrompt ? `\nAdditional persona instructions:\n${customPrompt}` : ''}

Instructions:
1. Respond as this person in a dating context - be friendly, interesting, and authentic
2. Use the profile information to inform your responses
3. Be conversational and engaging, but not overly eager
4. Show personality and humor where appropriate
5. After the 10th user message, you will evaluate if there's potential for a match

Remember: You're trying to see if this person is a good match while representing ${user.name || "the profile owner"}'s personality and interests.`;

  return basePrompt;
}

// Generate evaluation prompt after 10 messages
function generateEvaluationPrompt(messages: any[]): string {
  const conversationHistory = messages
    .map((msg) => `${msg.role === "user" ? "User" : "You"}: ${msg.content}`)
    .join("\n");

  return `Based on this conversation, evaluate the user using a detailed rubric:

${conversationHistory}

CRITICAL: Your response MUST be ONLY a valid JSON object. No markdown formatting, no code blocks, no explanatory text before or after. Just the raw JSON object.

Respond with this exact format:
{
  "decision": "approved",
  "rubric": {
    "engagement": 8,
    "depth": 7,
    "authenticity": 9,
    "respectfulness": 9,
    "compatibility": 8,
    "overall": 8
  },
  "reasoning": "Brief explanation of your decision (2-3 sentences)"
}

Replace the example numbers with your actual scores (1-10). The decision must be exactly "approved" or "rejected" (lowercase, quoted string).

RUBRIC SCORING GUIDELINES (1-10 scale):

**Engagement** - How invested and interested were they?
1-2: Barely responsive, no questions, clearly uninterested
3-4: Minimal effort, short answers, doesn't ask follow-ups
5-6: Adequate but passive, answers questions but doesn't drive conversation
7-8: Actively engaged, asks good questions, shows genuine interest
9-10: Highly engaged, enthusiastic, makes conversation flow naturally

**Depth** - How thoughtful and substantive were their responses?
1-2: One-word answers, no detail or elaboration
3-4: Surface-level, generic responses with little substance
5-6: Some detail but lacks insight or deeper thinking
7-8: Thoughtful responses with good detail and reflection
9-10: Insightful, nuanced responses that show real thought

**Authenticity** - How genuine did they seem?
1-2: Clearly using scripts/templates, feels robotic
3-4: Generic responses that could be copy-pasted to anyone
5-6: Somewhat personalized but still feels rehearsed
7-8: Genuine and personal, shows real personality
9-10: Completely authentic, unique voice, vulnerable and real

**Respectfulness** - How appropriate and emotionally intelligent?
1-2: Rude, inappropriate, offensive, or creepy
3-4: Pushy, boundary-crossing, or tone-deaf
5-6: Generally respectful but some awkward moments
7-8: Consistently respectful, good boundaries, emotionally aware
9-10: Exceptionally considerate, empathetic, perfect tone

**Compatibility** - How well do you match based on values/interests?
1-2: Major red flags or completely incompatible
3-4: Significant differences, little common ground
5-6: Some overlap but not much natural chemistry
7-8: Good shared interests and values, promising chemistry
9-10: Exceptional compatibility, aligned values, great chemistry

**Overall** - Holistic view of the conversation quality
1-2: Terrible conversation, waste of time
3-4: Poor conversation, lacks basic engagement
5-6: Mediocre, neither good nor bad
7-8: Good conversation, enjoyable and worthwhile
9-10: Excellent conversation, memorable and impressive

IMPORTANT: Score independently - someone can be respectful (9/10) but incompatible (3/10). The decision should be "approved" if overall >= 7 AND compatibility >= 6, otherwise "rejected".`;
}

// Action to send message and get AI response
export const sendMessage = action({
  args: {
    swiperId: v.string(),
    swipedId: v.string(),
    userMessage: v.string(),
    chatId: v.optional(v.string()), // Optional: use specific chatId for admin fresh chats
  },
  handler: async (ctx, args): Promise<{
    role: string;
    content: string;
    messageCount?: number;
    isEvaluation?: boolean;
    decision?: string;
  }> => {
    const chatId = args.chatId || `${args.swiperId}-${args.swipedId}`;

    // Get or create chat
    const chat: any = await ctx.runMutation(api.aiChat.getOrCreateChat, {
      swiperId: args.swiperId,
      swipedId: args.swipedId,
      chatId, // Pass the specific chatId
    });

    // Check if already at max messages
    if (chat.messageCount >= 10) {
      throw new Error("Maximum messages reached");
    }

    // Add user message
    const result: { messageCount: number } = await ctx.runMutation(api.aiChat.addMessageToChat, {
      chatId,
      role: "user",
      content: args.userMessage,
    });

    // Get swiped user for persona
    const swipedUser = await ctx.runQuery(api.users.getUserByClerkId, {
      clerkId: args.swipedId,
    });

    if (!swipedUser) {
      throw new Error("User not found");
    }

    // Check if this is the 10th message - if so, evaluate
    if (result.messageCount === 10) {
      // Get updated chat with all messages
      const updatedChat = await ctx.runQuery(api.aiChat.getChat, { chatId });

      if (!updatedChat) {
        throw new Error("Chat not found");
      }

      // Generate evaluation
      const evaluationPrompt = generateEvaluationPrompt(updatedChat.messages);

      const evaluationResponse = await groq.chat.completions.create({
        messages: [
          {
            role: "user",
            content: evaluationPrompt,
          },
        ],
        model: "llama-3.3-70b-versatile",
        temperature: 0.3, // Lower temperature for more consistent JSON output
      });

      const evaluationText = evaluationResponse.choices[0].message.content;

      // Log raw response for debugging
      console.log("Raw AI evaluation response:", evaluationText);

      // Parse JSON response with robust extraction
      let decision = "rejected";
      let reasoning = "Unable to evaluate";
      let rubric = {
        engagement: 5,
        depth: 5,
        authenticity: 5,
        respectfulness: 5,
        compatibility: 5,
        overall: 5,
      };

      try {
        // Try to extract JSON from markdown code blocks or plain text
        let jsonText = evaluationText || "{}";

        // Check if wrapped in markdown code block (```json ... ``` or ``` ... ```)
        const codeBlockMatch = jsonText.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
        if (codeBlockMatch) {
          jsonText = codeBlockMatch[1];
          console.log("Extracted JSON from markdown code block");
        } else {
          // Try to find JSON object in the text
          const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            jsonText = jsonMatch[0];
            console.log("Extracted JSON object from text");
          }
        }

        console.log("Attempting to parse JSON:", jsonText);
        const evaluation = JSON.parse(jsonText);

        decision = evaluation.decision || "rejected";
        reasoning = evaluation.reasoning || "No reasoning provided";
        rubric = evaluation.rubric || rubric;

        console.log("Successfully parsed evaluation:", { decision, reasoning, rubric });
      } catch (error) {
        console.error("Failed to parse evaluation:", error);
        console.error("Raw text that failed:", evaluationText);
        console.error("Error details:", error instanceof Error ? error.message : String(error));
      }

      // Save decision and rubric
      await ctx.runMutation(api.aiChat.setAiDecision, {
        chatId,
        decision,
        reasoning,
        rubric,
      });

      // Update user stats based on conversation quality
      await ctx.runMutation(internal.aiChat.updateUserStatsAfterEvaluation, {
        swiperId: args.swiperId,
        swipedId: args.swipedId,
        rubric,
        approved: decision === "approved",
      });

      // If approved, create a match
      if (decision === "approved") {
        await ctx.runMutation(api.aiChat.createMatchFromChat, {
          user1Id: args.swiperId,
          user2Id: args.swipedId,
        });
      }

      // Add AI decision message
      const finalMessage = decision === "approved"
        ? `I think we could be a great match! 💫\n\n${reasoning}\n\nI'd love to connect on LinkedIn and continue our conversation!`
        : `Thank you for the conversation! ${reasoning}\n\nI don't think we're quite the right match at this time, but I wish you the best! 🙏`;

      await ctx.runMutation(api.aiChat.addMessageToChat, {
        chatId,
        role: "assistant",
        content: finalMessage,
      });

      return {
        role: "assistant",
        content: finalMessage,
        isEvaluation: true,
        decision,
      };
    }

    // Generate persona prompt
    const personaPrompt = generatePersonaPrompt(swipedUser, swipedUser.aiPersonaPrompt);

    // Get AI response
    const completion: any = await groq.chat.completions.create({
      messages: [
        {
          role: "system",
          content: personaPrompt,
        },
        ...chat.messages.map((msg: any) => ({
          role: msg.role as "user" | "assistant",
          content: msg.content,
        })),
        {
          role: "user",
          content: args.userMessage,
        },
      ],
      model: "llama-3.3-70b-versatile",
      temperature: 0.8,
    });

    const aiResponse: string = completion.choices[0].message.content || "I'm not sure how to respond to that.";

    // Add AI response to chat
    await ctx.runMutation(api.aiChat.addMessageToChat, {
      chatId,
      role: "assistant",
      content: aiResponse,
    });

    return {
      role: "assistant",
      content: aiResponse,
      messageCount: result.messageCount,
    };
  },
});

// Create match from approved chat
export const createMatchFromChat = mutation({
  args: {
    user1Id: v.string(),
    user2Id: v.string(),
  },
  handler: async (ctx, args) => {
    // Check if match already exists
    const existingMatch = await ctx.db
      .query("matches")
      .filter((q) =>
        q.or(
          q.and(
            q.eq(q.field("user1Id"), args.user1Id),
            q.eq(q.field("user2Id"), args.user2Id)
          ),
          q.and(
            q.eq(q.field("user1Id"), args.user2Id),
            q.eq(q.field("user2Id"), args.user1Id)
          )
        )
      )
      .first();

    if (existingMatch) {
      return existingMatch._id;
    }

    // Create new match
    const matchId = await ctx.db.insert("matches", {
      user1Id: args.user1Id,
      user2Id: args.user2Id,
      timestamp: Date.now(),
      user1Approved: false,
      user2Approved: false,
      bothApproved: false,
    });

    return matchId;
  },
});

// Internal mutation to update user stats after AI evaluation
export const updateUserStatsAfterEvaluation = internalMutation({
  args: {
    swiperId: v.string(),
    swipedId: v.string(),
    rubric: v.object({
      engagement: v.number(),
      depth: v.number(),
      authenticity: v.number(),
      respectfulness: v.number(),
      compatibility: v.number(),
      overall: v.number(),
    }),
    approved: v.boolean(),
  },
  handler: async (ctx, args) => {
    // Get both users
    const swiper = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.swiperId))
      .first();

    const swiped = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.swipedId))
      .first();

    if (!swiper || !swiped) return;

    // Update swiper's stats (they had the conversation)
    const swiperConvoCount = (swiper.conversationsCompleted || 0) + 1;
    const swiperApprovals = (swiper.aiApprovalsReceived || 0) + (args.approved ? 1 : 0);
    const swiperRejections = (swiper.aiRejectionsReceived || 0) + (args.approved ? 0 : 1);

    // Calculate new average rubric scores for swiper
    const currentAvg = swiper.avgRubricScores || {
      engagement: 5,
      depth: 5,
      authenticity: 5,
      respectfulness: 5,
      compatibility: 5,
      overall: 5,
    };

    const newAvg = {
      engagement: ((currentAvg.engagement * (swiperConvoCount - 1)) + args.rubric.engagement) / swiperConvoCount,
      depth: ((currentAvg.depth * (swiperConvoCount - 1)) + args.rubric.depth) / swiperConvoCount,
      authenticity: ((currentAvg.authenticity * (swiperConvoCount - 1)) + args.rubric.authenticity) / swiperConvoCount,
      respectfulness: ((currentAvg.respectfulness * (swiperConvoCount - 1)) + args.rubric.respectfulness) / swiperConvoCount,
      compatibility: ((currentAvg.compatibility * (swiperConvoCount - 1)) + args.rubric.compatibility) / swiperConvoCount,
      overall: ((currentAvg.overall * (swiperConvoCount - 1)) + args.rubric.overall) / swiperConvoCount,
    };

    // Calculate ELO change based on conversation quality (for swiper)
    const swiperElo = swiper.eloScore || 1000;
    const swipedElo = swiped.eloScore || 1000;
    const eloChange = calculateEloChangeFromConversation(swiperElo, swipedElo, args.rubric.overall);

    // Update swiper
    await ctx.db.patch(swiper._id, {
      conversationsCompleted: swiperConvoCount,
      aiApprovalsReceived: swiperApprovals,
      aiRejectionsReceived: swiperRejections,
      avgRubricScores: newAvg,
      eloScore: swiperElo + eloChange,
    });

    return { success: true };
  },
});
