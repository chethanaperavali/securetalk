import { useState, useRef, useEffect } from 'react';
import { useMessages } from '@/hooks/useMessages';
import { useConversations } from '@/hooks/useConversations';
import { useTypingIndicator } from '@/hooks/useTypingIndicator';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { TypingIndicator } from '@/components/chat/TypingIndicator';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Shield, Send, Lock, Loader2, MoreVertical, Pencil, Trash2, X, Check } from 'lucide-react';
import { format } from 'date-fns';

interface ChatViewProps {
  conversationId: string | null;
}

export function ChatView({ conversationId }: ChatViewProps) {
  const { user } = useAuth();
  const { messages, isLoading, sendMessage, editMessage, deleteMessage, isEncryptionReady } =
    useMessages(conversationId);
  const { conversations } = useConversations();
  const { otherUserTyping, setTyping } = useTypingIndicator(conversationId);
  const [newMessage, setNewMessage] = useState('');
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  const conversation = conversations.find((c) => c.id === conversationId);
  const otherParticipant = conversation?.participants.find(
    (p) => p.user_id !== user?.id
  )?.profiles;

  // Auto-scroll to bottom on new messages or typing
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, otherUserTyping]);

  const handleSend = async () => {
    if (!newMessage.trim() || sendMessage.isPending) return;
    try {
      setTyping(false);
      await sendMessage.mutateAsync(newMessage.trim());
      setNewMessage('');
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  };

  const handleEdit = async () => {
    if (!editingMessageId || !editContent.trim()) return;
    try {
      await editMessage.mutateAsync({ messageId: editingMessageId, content: editContent.trim() });
      setEditingMessageId(null);
      setEditContent('');
    } catch (error) {
      console.error('Failed to edit message:', error);
    }
  };

  const handleDelete = async (messageId: string) => {
    try {
      await deleteMessage.mutateAsync(messageId);
    } catch (error) {
      console.error('Failed to delete message:', error);
    }
  };

  const startEditing = (messageId: string, currentContent: string) => {
    setEditingMessageId(messageId);
    setEditContent(currentContent);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewMessage(e.target.value);
    if (e.target.value.trim()) {
      setTyping(true);
    } else {
      setTyping(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!conversationId) {
    return (
      <div className="h-full flex items-center justify-center bg-background">
        <div className="text-center space-y-4 p-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl gradient-secure shadow-secure">
            <Shield className="w-8 h-8 text-primary-foreground" />
          </div>
          <h2 className="text-xl font-semibold">Echo Secure</h2>
          <p className="text-muted-foreground max-w-sm">
            Select a conversation or start a new one to begin messaging with end-to-end encryption.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header */}
      <div className="p-4 border-b border-border flex items-center gap-3 bg-card">
        <Avatar className="h-10 w-10">
          <AvatarImage src={otherParticipant?.avatar_url || undefined} />
          <AvatarFallback className="gradient-secure text-primary-foreground">
            {otherParticipant?.display_name?.[0] || otherParticipant?.username?.[0] || '?'}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <h3 className="font-semibold">
            {otherParticipant?.display_name || otherParticipant?.username}
          </h3>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Lock className="w-3 h-3 text-primary" />
            <span>End-to-end encrypted</span>
          </div>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea ref={scrollRef} className="flex-1 p-4">
        {isLoading || !isEncryptionReady ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center text-muted-foreground">
              <Shield className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No messages yet</p>
              <p className="text-xs mt-1">Send a message to start the conversation</p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((message) => {
              const isOwnMessage = message.sender_id === user?.id;
              const isEditing = editingMessageId === message.id;

              return (
                <div
                  key={message.id}
                  className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'} group`}
                >
                  <div className={`flex items-start gap-1 max-w-[75%] ${isOwnMessage ? 'flex-row-reverse' : ''}`}>
                    <div
                      className={`rounded-2xl px-4 py-2.5 ${
                        isOwnMessage
                          ? 'gradient-secure text-primary-foreground rounded-br-md'
                          : 'bg-secondary text-secondary-foreground rounded-bl-md'
                      }`}
                    >
                      {isEditing ? (
                        <div className="flex items-center gap-2">
                          <Input
                            value={editContent}
                            onChange={(e) => setEditContent(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleEdit();
                              if (e.key === 'Escape') setEditingMessageId(null);
                            }}
                            className="h-7 text-sm bg-background/20 border-primary-foreground/30 text-inherit"
                            autoFocus
                          />
                          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={handleEdit}>
                            <Check className="w-3.5 h-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setEditingMessageId(null)}>
                            <X className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      ) : (
                        <p className="text-sm whitespace-pre-wrap break-words">
                          {message.decrypted_content}
                        </p>
                      )}
                      <div className={`flex items-center gap-1 mt-1`}>
                        <p
                          className={`text-[10px] ${
                            isOwnMessage ? 'text-primary-foreground/70' : 'text-muted-foreground'
                          }`}
                        >
                          {format(new Date(message.created_at), 'HH:mm')}
                          {message.edited_at && ' · edited'}
                        </p>
                      </div>
                    </div>

                    {/* Edit/Delete menu for own messages */}
                    {isOwnMessage && !isEditing && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                          >
                            <MoreVertical className="w-3.5 h-3.5 text-muted-foreground" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-32">
                          <DropdownMenuItem onClick={() => startEditing(message.id, message.decrypted_content || '')}>
                            <Pencil className="w-3.5 h-3.5 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => handleDelete(message.id)}
                          >
                            <Trash2 className="w-3.5 h-3.5 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                </div>
              );
            })}
            {otherUserTyping && (
              <TypingIndicator username={otherParticipant?.display_name || otherParticipant?.username} />
            )}
          </div>
        )}
      </ScrollArea>

      {/* Input */}
      <div className="p-4 border-t border-border bg-card">
        <div className="flex gap-2">
          <Input
            placeholder="Type a message..."
            value={newMessage}
            onChange={handleInputChange}
            onKeyPress={handleKeyPress}
            disabled={!isEncryptionReady}
            className="flex-1"
          />
          <Button
            onClick={handleSend}
            disabled={!newMessage.trim() || sendMessage.isPending || !isEncryptionReady}
            className="gradient-secure"
          >
            {sendMessage.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        </div>
        <div className="flex items-center justify-center gap-1 mt-2 text-[10px] text-muted-foreground">
          <Lock className="w-2.5 h-2.5" />
          <span>Messages are encrypted with AES-256</span>
        </div>
      </div>
    </div>
  );
}
