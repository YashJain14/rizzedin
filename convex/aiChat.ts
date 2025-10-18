import { v } from "convex/values";
import { mutation, query, action } from "./_generated/server";
import { api } from "./_generated/api";
import Groq from "groq-sdk";

// Initialize Groq client
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// Get or create AI chat
export const getOrCreateChat = mutation({
  args: {
    swiperId: v.string(),
    swipedId: v.string(),
  },
  handler: async (ctx, args) => {
    const chatId = `${args.swiperId}-${args.swipedId}`;

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

  return `Based on this conversation, evaluate if this person would be a good match:

${conversationHistory}

Respond with ONLY a JSON object in this exact format:
{
  "decision": "approved" or "rejected",
  "reasoning": "Brief explanation of your decision (1-2 sentences)"
}

Consider:
- Quality of conversation and effort
- Genuine interest and engagement
- Compatibility based on shared interests
- Respect and appropriate tone
- Overall chemistry`;
}

// Action to send message and get AI response
export const sendMessage = action({
  args: {
    swiperId: v.string(),
    swipedId: v.string(),
    userMessage: v.string(),
  },
  handler: async (ctx, args): Promise<{
    role: string;
    content: string;
    messageCount?: number;
    isEvaluation?: boolean;
    decision?: string;
  }> => {
    const chatId = `${args.swiperId}-${args.swipedId}`;

    // Get or create chat
    const chat: any = await ctx.runMutation(api.aiChat.getOrCreateChat, {
      swiperId: args.swiperId,
      swipedId: args.swipedId,
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
        temperature: 0.7,
      });

      const evaluationText = evaluationResponse.choices[0].message.content;

      // Parse JSON response
      let decision = "rejected";
      let reasoning = "Unable to evaluate";

      try {
        const evaluation = JSON.parse(evaluationText || "{}");
        decision = evaluation.decision || "rejected";
        reasoning = evaluation.reasoning || "No reasoning provided";
      } catch (error) {
        console.error("Failed to parse evaluation:", error);
      }

      // Save decision
      await ctx.runMutation(api.aiChat.setAiDecision, {
        chatId,
        decision,
        reasoning,
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
