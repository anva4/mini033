import { useState, useEffect, useRef } from "react";
import { useRoute, Link, useLocation } from "wouter";
import { useGetChats, getGetChatsQueryKey, useGetMessages, getGetMessagesQueryKey, useSendMessage } from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth";
import { useLang } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Send, User, MessageCircle } from "lucide-react";

export default function MessagesPage() {
  const [, params] = useRoute("/messages/:userId");
  const chatUserId = params?.userId;
  // FIX: все хуки вызываются ДО условного return (Rules of Hooks)
  const { isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();

  // FIX: условный return ПОСЛЕ всех хуков
  if (!isAuthenticated) {
    setLocation("/auth");
    return null;
  }

  if (chatUserId) return <ChatView userId={chatUserId} />;
  return <ChatList />;
}

function ChatList() {
  const { t } = useLang();
  const { data: chats, isLoading } = useGetChats({ query: { queryKey: getGetChatsQueryKey() } });

  return (
    <div className="flex flex-col pb-4">
      <div className="sticky top-0 z-30 px-4 py-3 glass border-b border-border/30">
        <h1 className="font-bold">{t("messages")}</h1>
      </div>
      <div className="flex flex-col">
        {isLoading ? Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 mx-4 my-1 rounded-xl" />) :
          chats?.map((chat) => (
            <Link key={chat.userId} href={`/messages/${chat.userId}`} data-testid={`chat-${chat.userId}`}>
              <div className="flex items-center gap-3 px-4 py-3 hover:bg-card/50 transition-colors">
                <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center overflow-hidden shrink-0">
                  {chat.user?.avatar ? <img src={chat.user.avatar} className="w-full h-full object-cover" /> : <User className="w-5 h-5 text-muted-foreground" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm truncate">{chat.user?.username}</span>
                    {(chat.unreadCount ?? 0) > 0 && (
                      <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground text-[10px] flex items-center justify-center font-bold shrink-0">{chat.unreadCount}</span>
                    )}
                  </div>
                  {chat.lastMessage && (
                    <p className="text-xs text-muted-foreground truncate mt-0.5">{chat.lastMessage.text}</p>
                  )}
                </div>
              </div>
            </Link>
          ))
        }
        {!isLoading && (!chats || chats.length === 0) && (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <MessageCircle className="w-12 h-12 mb-3 opacity-30" />
            <p className="text-sm">{t("noMessages")}</p>
          </div>
        )}
      </div>
    </div>
  );
}

function ChatView({ userId }: { userId: string }) {
  const { t } = useLang();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [text, setText] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data: msgs, isLoading } = useGetMessages(userId, {}, {
    query: {
      queryKey: getGetMessagesQueryKey(userId),
      refetchInterval: 5000,
      refetchIntervalInBackground: false,
    },
  });
  const sendMsg = useSendMessage();

  // FIX: автоскролл к последнему сообщению при получении новых
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    sendMsg.mutate({ userId, data: { text: text.trim() } }, {
      onSuccess: () => {
        setText("");
        queryClient.invalidateQueries({ queryKey: getGetMessagesQueryKey(userId) });
        queryClient.invalidateQueries({ queryKey: getGetChatsQueryKey() });
      },
    });
  };

  return (
    <div className="flex flex-col h-[calc(100vh-56px)]">
      <div className="sticky top-0 z-30 flex items-center gap-3 px-4 py-3 glass border-b border-border/30">
        <Button variant="ghost" size="icon" onClick={() => window.history.back()}><ArrowLeft className="w-5 h-5" /></Button>
        <Link href={`/profile/${userId}`} className="font-bold text-sm">{msgs?.[0]?.sender?.username || userId}</Link>
      </div>

      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2">
        {isLoading && Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-2/3 rounded-xl" />)}
        {msgs?.map((msg) => {
          const isMe = msg.senderId === user?.id;
          return (
            <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${isMe ? "gradient-primary text-white rounded-br-md" : "bg-card text-foreground rounded-bl-md"}`} data-testid={`msg-${msg.id}`}>
                {msg.text}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={handleSend} className="px-4 py-3 border-t border-border/30 flex gap-2">
        <Input value={text} onChange={(e) => setText(e.target.value)} placeholder={t("writeMessage")} className="flex-1 h-10" data-testid="input-message" maxLength={4000} />
        <Button type="submit" size="icon" className="h-10 w-10 gradient-primary border-0 shrink-0" disabled={sendMsg.isPending || !text.trim()} data-testid="button-send">
          <Send className="w-4 h-4" />
        </Button>
      </form>
    </div>
  );
}
