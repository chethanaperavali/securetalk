import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { generateKey, exportKey, storeConversationKey } from '@/lib/encryption';

interface Profile {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
}

interface ConversationParticipant {
  user_id: string;
  profiles: Profile;
}

interface Conversation {
  id: string;
  created_at: string;
  updated_at: string;
  participants: ConversationParticipant[];
}

export function useConversations() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['conversations', user?.id],
    queryFn: async () => {
      if (!user) return [];

      const { data, error } = await supabase
        .from('conversations')
        .select(`
          id,
          created_at,
          updated_at,
          conversation_participants (
            user_id,
            profiles (
              id,
              username,
              display_name,
              avatar_url
            )
          )
        `)
        .order('updated_at', { ascending: false });

      if (error) throw error;

      // Transform the data to match our interface
      return (data || []).map((conv: any) => ({
        ...conv,
        participants: conv.conversation_participants || [],
      })) as Conversation[];
    },
    enabled: !!user,
  });

  const createConversation = useMutation({
    mutationFn: async (participantUsername: string) => {
      if (!user) throw new Error('Not authenticated');

      // Find the user by username
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('user_id')
        .eq('username', participantUsername)
        .maybeSingle();

      if (profileError) throw profileError;
      if (!profile) throw new Error('User not found');

      // Create the conversation
      const { data: conversation, error: convError } = await supabase
        .from('conversations')
        .insert({})
        .select()
        .single();

      if (convError) throw convError;

      // Add both participants
      const { error: partError } = await supabase
        .from('conversation_participants')
        .insert([
          { conversation_id: conversation.id, user_id: user.id },
          { conversation_id: conversation.id, user_id: profile.user_id },
        ]);

      if (partError) throw partError;

      // Generate and store encryption key for this conversation
      const key = await generateKey();
      const keyString = await exportKey(key);
      storeConversationKey(conversation.id, keyString);

      return conversation;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
  });

  return {
    conversations: query.data || [],
    isLoading: query.isLoading,
    error: query.error,
    createConversation,
  };
}
