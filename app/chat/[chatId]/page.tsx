"use client";

import { useUser } from "@clerk/nextjs";
import { useQuery, useAction, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useState, useRef, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Loader2, Send, ArrowLeft, Sparkles, Heart, X, MessageCircle } from "lucide-react";
import { toast } from "sonner";

export default function ChatPage() {
  const { user } = useUser();
  const params = useParams();
  const router = useRouter();
  const chatId = params.chatId as string;

  const [message, setMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const chat = useQuery(api.aiChat.getChat, { chatId });
  const sendMessage = useAction(api.aiChat.sendMessage);

  // Get swiperId and swipedId from the chat document (safer than parsing)
  const swiperId = chat?.swiperId;
  const swipedId = chat?.swipedId;

  // Get swiped user details
  const swipedUser = useQuery(
    api.users.getUserByClerkId,
    swipedId ? { clerkId: swipedId } : "skip"
  );

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat?.messages]);

  const handleSendMessage = async () => {
    if (!message.trim() || !user || isSending) return;

    if (!chat || chat.messageCount >= 10) {
      toast.error("Maximum messages reached");
      return;
    }

    if (!swipedId) {
      toast.error("Invalid chat");
      return;
    }

    setIsSending(true);
    const userMessage = message;
    setMessage("");

    try {
      const response = await sendMessage({
        swiperId: user.id,
        swipedId,
        userMessage,
        chatId, // Pass the full chatId to ensure correct chat is used
      });

      if (response.isEvaluation) {
        // Show special toast for evaluation
        if (response.decision === "approved") {
          toast.success("🎉 It's a match!", {
            description: "Check your matches page to connect on LinkedIn!",
          });
          // Redirect to matches after a delay
          setTimeout(() => {
            router.push("/matches");
          }, 2000);
        } else {
          toast.error("Not a match this time", {
            description: "Keep swiping to find your perfect match!",
          });
        }
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to send message");
      setMessage(userMessage); // Restore message on error
    } finally {
      setIsSending(false);
    }
  };

  // Show loading while queries are resolving
  if (chat === undefined || swipedUser === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // If queries resolved but data is missing, show error
  if (!chat || !swipedUser) {
    console.error("Chat page error:", {
      chatId,
      chat,
      swipedUser,
      swiperId,
      swipedId,
    });

    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <p className="text-muted-foreground">
              {!chat ? `Chat not found (ID: ${chatId})` : "User not found"}
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              This might be a timing issue. Try refreshing the page.
            </p>
            <div className="flex gap-2 mt-4 justify-center">
              <Button onClick={() => window.location.reload()} variant="outline">
                Refresh
              </Button>
              <Button onClick={() => router.push("/fyp")}>
                Back to FYP
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const messagesRemaining = 10 - chat.messageCount;
  const isComplete = chat.messageCount >= 10;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <div className="container mx-auto p-4 max-w-4xl">
        {/* Header */}
        <div className="mb-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/fyp")}
            className="mb-2"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to FYP
          </Button>

          <Card>
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Avatar className="h-12 w-12">
                    <AvatarImage src={swipedUser.image} alt={swipedUser.name} />
                    <AvatarFallback>
                      {swipedUser.name?.[0]?.toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <CardTitle className="text-lg flex items-center gap-2">
                      {swipedUser.name}
                      <Sparkles className="h-4 w-4 text-primary" />
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">
                      AI Persona • {swipedUser.age} years old
                    </p>
                  </div>
                </div>

                <Badge
                  variant={isComplete ? "secondary" : "default"}
                  className="text-sm"
                >
                  {messagesRemaining} {messagesRemaining === 1 ? "message" : "messages"} left
                </Badge>
              </div>
            </CardHeader>
          </Card>
        </div>

        {/* Chat Messages */}
        <Card className="mb-4">
          <CardContent className="p-4">
            <div className="space-y-4 max-h-[500px] overflow-y-auto">
              {chat.messages.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Sparkles className="h-8 w-8 mx-auto mb-2 text-primary" />
                  <p className="text-sm">
                    Start chatting with {swipedUser.name}'s AI persona!
                  </p>
                  <p className="text-xs mt-1">
                    You have 10 messages to make a great impression
                  </p>
                </div>
              ) : (
                <>
                  {chat.messages.map((msg: { role: string; content: string; timestamp: number }, idx: number) => (
                    <div
                      key={idx}
                      className={`flex ${
                        msg.role === "user" ? "justify-end" : "justify-start"
                      }`}
                    >
                      <div
                        className={`max-w-[80%] rounded-lg p-3 ${
                          msg.role === "user"
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted"
                        }`}
                      >
                        <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                        <p className="text-xs opacity-70 mt-1">
                          {new Date(msg.timestamp).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                    </div>
                  ))}
                </>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* AI Decision Display */}
            {isComplete && chat.aiDecision && (
              <div className="mt-4 p-4 rounded-lg border-2 border-primary/20 bg-primary/5">
                <div className="flex items-center gap-2 mb-2">
                  {chat.aiDecision === "approved" ? (
                    <Heart className="h-5 w-5 text-green-500" />
                  ) : (
                    <X className="h-5 w-5 text-red-500" />
                  )}
                  <p className="font-semibold">
                    {chat.aiDecision === "approved"
                      ? "Match Created! 🎉"
                      : "Not a Match"}
                  </p>
                </div>
                <p className="text-sm text-muted-foreground">
                  {chat.aiReasoning}
                </p>
                {chat.aiDecision === "approved" && (
                  <Button
                    onClick={() => router.push("/matches")}
                    className="mt-3 w-full"
                  >
                    View Match
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Message Input */}
        {!isComplete && (
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                {/* Message Counter */}
                <div className="flex items-center gap-1.5 px-3 py-2 bg-primary/10 rounded-lg border border-primary/20 whitespace-nowrap">
                  <MessageCircle className={`h-4 w-4 ${messagesRemaining <= 3 ? 'text-orange-500' : 'text-primary'}`} />
                  <span className={`text-sm font-medium ${messagesRemaining <= 3 ? 'text-orange-600 dark:text-orange-500' : 'text-primary'}`}>
                    {messagesRemaining} left
                  </span>
                </div>

                <Input
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  placeholder="Type your message..."
                  disabled={isSending || isComplete}
                  className="flex-1"
                />
                <Button
                  onClick={handleSendMessage}
                  disabled={!message.trim() || isSending || isComplete}
                  size="icon"
                >
                  {isSending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
