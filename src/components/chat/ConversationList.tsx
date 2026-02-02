import { useState } from 'react';
import { useConversations } from '@/hooks/useConversations';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { MessageSquarePlus, Search, Shield, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ConversationListProps {
  selectedConversation: string | null;
  onSelectConversation: (id: string) => void;
}

export function ConversationList({
  selectedConversation,
  onSelectConversation,
}: ConversationListProps) {
  const { user } = useAuth();
  const { conversations, isLoading, createConversation } = useConversations();
  const [searchQuery, setSearchQuery] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const { toast } = useToast();

  const handleCreateConversation = async () => {
    if (!newUsername.trim()) return;

    try {
      const result = await createConversation.mutateAsync(newUsername.trim());
      setNewUsername('');
      setDialogOpen(false);
      onSelectConversation(result.id);
      toast({
        title: 'Conversation created',
        description: 'End-to-end encryption is now active.',
      });
    } catch (error: any) {
      toast({
        title: 'Failed to create conversation',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const getOtherParticipant = (conversation: typeof conversations[0]) => {
    const other = conversation.participants.find(
      (p) => p.user_id !== user?.id
    );
    return other?.profiles;
  };

  const filteredConversations = conversations.filter((conv) => {
    const other = getOtherParticipant(conv);
    if (!other) return false;
    const searchLower = searchQuery.toLowerCase();
    return (
      other.username.toLowerCase().includes(searchLower) ||
      (other.display_name?.toLowerCase().includes(searchLower) ?? false)
    );
  });

  return (
    <div className="h-full flex flex-col border-r border-border bg-card">
      {/* Header */}
      <div className="p-4 border-b border-border space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            <h2 className="font-semibold">Messages</h2>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="icon" variant="ghost" className="h-8 w-8">
                <MessageSquarePlus className="w-4 h-4" />
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>New secure conversation</DialogTitle>
                <DialogDescription>
                  Enter the username of the person you want to message.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <Input
                  placeholder="Username"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                />
                <Button
                  onClick={handleCreateConversation}
                  disabled={!newUsername.trim() || createConversation.isPending}
                  className="w-full gradient-secure"
                >
                  {createConversation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <Shield className="w-4 h-4 mr-2" />
                  )}
                  Start encrypted chat
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Conversations list */}
      <ScrollArea className="flex-1">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : filteredConversations.length === 0 ? (
          <div className="text-center py-8 px-4 text-muted-foreground">
            <MessageSquarePlus className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No conversations yet</p>
            <p className="text-xs mt-1">Start a new secure chat above</p>
          </div>
        ) : (
          <div className="p-2 space-y-1">
            {filteredConversations.map((conversation) => {
              const other = getOtherParticipant(conversation);
              if (!other) return null;

              const isSelected = selectedConversation === conversation.id;

              return (
                <button
                  key={conversation.id}
                  onClick={() => onSelectConversation(conversation.id)}
                  className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors text-left ${
                    isSelected
                      ? 'bg-primary/10 text-primary'
                      : 'hover:bg-muted'
                  }`}
                >
                  <Avatar className="h-10 w-10">
                    <AvatarFallback className={isSelected ? 'gradient-secure text-primary-foreground' : 'bg-secondary'}>
                      {other.display_name?.[0] || other.username[0]}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate">
                        {other.display_name || other.username}
                      </span>
                      <Shield className="w-3 h-3 text-primary flex-shrink-0" />
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      @{other.username}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
