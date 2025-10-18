'use client';

import { useUser } from '@clerk/nextjs';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  Heart,
  Loader2,
  Sparkles,
  Check,
  ExternalLink,
  Clock,
  MessageCircle,
  ChevronDown,
  ChevronUp,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function MatchesPage() {
  const { user } = useUser();
  const router = useRouter();

  const matches = useQuery(
    api.matches.getUserMatches,
    user?.id ? { clerkId: user.id } : 'skip'
  );

  const chats = useQuery(
    api.aiChat.getUserChats,
    user?.id ? { clerkId: user.id } : 'skip'
  );

  const approveMatch = useMutation(api.matches.approveMatch);

  const handleApprove = async (matchId: any) => {
    if (!user) return;

    try {
      await approveMatch({
        matchId,
        clerkId: user.id,
      });
      toast.success('Match approved! Waiting for the other person to approve.');
    } catch (error: any) {
      toast.error(error.message || 'Failed to approve match');
    }
  };

  // Organize chats by status
  const ongoingChats = chats?.filter((chat) => chat.messageCount < 10) || [];
  const matchedChats =
    chats?.filter((chat) => chat.aiDecision === 'approved') || [];
  const rejectedChats =
    chats?.filter((chat) => chat.aiDecision === 'rejected') || [];

  if (!matches || !chats) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <div className="container mx-auto p-4 md:p-8 max-w-6xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight flex items-center gap-3">
            <Heart className="h-8 w-8 md:h-10 md:w-10 text-primary fill-primary" />
            Your Matches
          </h1>
          <p className="text-muted-foreground mt-2">
            {matches.length} {matches.length === 1 ? 'match' : 'matches'}
          </p>
        </div>

        {/* Matches Grid */}
        {matches.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
            {matches.map((match) => (
              <Card
                key={match.matchId}
                className="overflow-hidden hover:shadow-lg transition-shadow"
              >
                <div className="relative h-48 md:h-56 bg-gradient-to-br from-primary/20 to-primary/5">
                  {match.user?.image ? (
                    <img
                      src={match.user.image}
                      alt={match.user.name || 'Match'}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-5xl font-bold text-primary/20">
                      {match.user?.name?.[0]?.toUpperCase()}
                    </div>
                  )}
                  <div className="absolute top-3 right-3">
                    <Badge
                      variant="secondary"
                      className="bg-background/90 backdrop-blur"
                    >
                      <Sparkles className="h-3 w-3 mr-1" />
                      Match
                    </Badge>
                  </div>
                </div>

                <CardContent className="p-4 space-y-4">
                  {/* Profile Info */}
                  <div>
                    <h3 className="font-bold text-xl">
                      {match.user?.name}, {match.user?.age}
                    </h3>
                    {match.user?.bio && (
                      <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                        {match.user.bio}
                      </p>
                    )}
                    <Badge variant="outline" className="mt-2">
                      {match.user?.gender}
                    </Badge>
                  </div>

                  {/* Approval Status & Actions */}
                  <div className="space-y-2">
                    {match.bothApproved ? (
                      <>
                        <div className="flex items-center gap-2 text-green-600 mb-2">
                          <Check className="h-4 w-4" />
                          <span className="text-sm font-medium">
                            Both Approved!
                          </span>
                        </div>
                        {match.user?.linkedinUrl ? (
                          <Button className="w-full" size="sm" asChild>
                            <a
                              href={match.user.linkedinUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <ExternalLink className="h-4 w-4 mr-2" />
                              View LinkedIn Profile
                            </a>
                          </Button>
                        ) : (
                          <p className="text-xs text-center text-muted-foreground">
                            No LinkedIn URL available
                          </p>
                        )}
                      </>
                    ) : match.currentUserApproved ? (
                      <>
                        <div className="flex items-center gap-2 text-amber-600 mb-2">
                          <Clock className="h-4 w-4" />
                          <span className="text-sm font-medium">
                            Waiting for approval...
                          </span>
                        </div>
                        <Button
                          className="w-full"
                          size="sm"
                          variant="secondary"
                          disabled
                        >
                          <Check className="h-4 w-4 mr-2" />
                          You Approved
                        </Button>
                      </>
                    ) : (
                      <>
                        <p className="text-xs text-muted-foreground mb-2">
                          Approve to share LinkedIn profiles with each other
                        </p>
                        <Button
                          className="w-full"
                          size="sm"
                          onClick={() => handleApprove(match.matchId)}
                        >
                          <Heart className="h-4 w-4 mr-2" />
                          Approve Match
                        </Button>
                      </>
                    )}

                    <p className="text-xs text-center text-muted-foreground mt-2">
                      Matched{' '}
                      {new Date(match.timestamp).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="pt-6 text-center space-y-4">
              <div className="flex justify-center">
                <Heart className="h-16 w-16 text-muted-foreground/20" />
              </div>
              <div>
                <h2 className="text-xl font-semibold mb-2">No matches yet</h2>
                <p className="text-muted-foreground">
                  Start swiping to chat with AI personas and find your perfect
                  match!
                </p>
              </div>
              <Button asChild>
                <a href="/fyp">Start Swiping</a>
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Chat History Section */}
        {chats.length > 0 && (
          <div className="mt-12">
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-3 mb-6">
              <MessageCircle className="h-7 w-7 text-primary" />
              Chat History
            </h2>

            {/* Ongoing Chats Section */}
            {ongoingChats.length > 0 && (
              <div className="mb-8">
                <div className="flex items-center gap-2 mb-4">
                  <h3 className="text-xl font-semibold">
                    Ongoing Conversations
                  </h3>
                  <Badge variant="default" className="animate-pulse">
                    {ongoingChats.length}
                  </Badge>
                </div>
                <div className="space-y-4">
                  {ongoingChats.map((chat) => (
                    <ChatCard
                      key={chat._id}
                      chat={chat}
                      status="ongoing"
                      onNavigate={(chatId) => router.push(`/chat/${chatId}`)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Matched Chats Section */}
            {matchedChats.length > 0 && (
              <div className="mb-8">
                <div className="flex items-center gap-2 mb-4">
                  <h3 className="text-xl font-semibold">
                    Matched Conversations
                  </h3>
                  <Badge
                    variant="secondary"
                    className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200"
                  >
                    {matchedChats.length}
                  </Badge>
                </div>
                <div className="space-y-4">
                  {matchedChats.map((chat) => (
                    <ChatCard
                      key={chat._id}
                      chat={chat}
                      status="matched"
                      onNavigate={(chatId) => router.push(`/chat/${chatId}`)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Rejected Chats Section */}
            {rejectedChats.length > 0 && (
              <div className="mb-8">
                <div className="flex items-center gap-2 mb-4">
                  <h3 className="text-xl font-semibold">Past Conversations</h3>
                  <Badge variant="outline" className="text-muted-foreground">
                    {rejectedChats.length}
                  </Badge>
                </div>
                <div className="space-y-4">
                  {rejectedChats.map((chat) => (
                    <ChatCard
                      key={chat._id}
                      chat={chat}
                      status="rejected"
                      onNavigate={(chatId) => router.push(`/chat/${chatId}`)}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Chat Card Component
function ChatCard({
  chat,
  status,
  onNavigate,
}: {
  chat: any;
  status: 'ongoing' | 'matched' | 'rejected';
  onNavigate: (chatId: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const statusConfig = {
    ongoing: {
      borderColor: 'border-l-4 border-l-primary',
      badgeColor: 'bg-primary text-primary-foreground',
      icon: <Clock className="h-4 w-4" />,
      badgeText: `${chat.messageCount}/10 messages`,
      actionButton: 'Continue Chat',
      actionVariant: 'default' as const,
    },
    matched: {
      borderColor: 'border-l-4 border-l-green-500',
      badgeColor:
        'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200',
      icon: <Heart className="h-4 w-4 fill-current" />,
      badgeText: 'Matched!',
      actionButton: 'View Chat',
      actionVariant: 'secondary' as const,
    },
    rejected: {
      borderColor: 'border-l-4 border-l-muted',
      badgeColor: 'bg-muted text-muted-foreground',
      icon: <X className="h-4 w-4" />,
      badgeText: 'Not Matched',
      actionButton: 'View Chat',
      actionVariant: 'outline' as const,
    },
  };

  const config = statusConfig[status];
  const lastMessage = chat.messages[chat.messages.length - 1];

  return (
    <Card
      className={`${config.borderColor} ${status === 'ongoing' ? 'shadow-lg' : ''}`}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <Avatar className="h-12 w-12">
              <AvatarImage
                src={chat.swipedUser?.image}
                alt={chat.swipedUser?.name}
              />
              <AvatarFallback>
                {chat.swipedUser?.name?.[0]?.toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div>
              <CardTitle className="text-lg">
                {chat.swipedUser?.name}
                {chat.swipedUser?.age && `, ${chat.swipedUser.age}`}
              </CardTitle>
              {chat.swipedUser?.bio && (
                <p className="text-sm text-muted-foreground line-clamp-1 mt-1">
                  {chat.swipedUser.bio}
                </p>
              )}
              <div className="flex items-center gap-2 mt-2">
                <Badge className={config.badgeColor}>
                  <span className="flex items-center gap-1">
                    {config.icon}
                    {config.badgeText}
                  </span>
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {new Date(
                    lastMessage?.timestamp || chat.timestamp
                  ).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Button
              variant={config.actionVariant}
              size="sm"
              onClick={() => onNavigate(chat.chatId)}
            >
              {config.actionButton}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? (
                <>
                  <ChevronUp className="h-4 w-4 mr-1" />
                  Hide
                </>
              ) : (
                <>
                  <ChevronDown className="h-4 w-4 mr-1" />
                  Show
                </>
              )}
            </Button>
          </div>
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="pt-0">
          <div className="border-t pt-4">
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {chat.messages.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No messages yet
                </p>
              ) : (
                chat.messages.map((msg: any, idx: number) => (
                  <div
                    key={idx}
                    className={`flex ${
                      msg.role === 'user' ? 'justify-end' : 'justify-start'
                    }`}
                  >
                    <div
                      className={`max-w-[80%] rounded-lg p-3 ${
                        msg.role === 'user'
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted'
                      }`}
                    >
                      <p className="text-sm whitespace-pre-wrap">
                        {msg.content}
                      </p>
                      <p className="text-xs opacity-70 mt-1">
                        {new Date(msg.timestamp).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Show AI Decision if available */}
            {chat.aiDecision && chat.aiReasoning && (
              <div
                className={`mt-4 p-3 rounded-lg border ${
                  chat.aiDecision === 'approved'
                    ? 'bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800'
                    : 'bg-muted border-border'
                }`}
              >
                <p className="text-sm font-medium mb-1">
                  {chat.aiDecision === 'approved'
                    ? 'Match Decision:'
                    : 'Decision:'}
                </p>
                <p className="text-sm text-muted-foreground">
                  {chat.aiReasoning}
                </p>
              </div>
            )}
          </div>
        </CardContent>
      )}
    </Card>
  );
}
