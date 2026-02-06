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

      // First get conversations the user participates in
      const { data: participantData, error: participantError } = await supabase
        .from('conversation_participants')
        .select('conversation_id')
        .eq('user_id', user.id);

      if (participantError) throw participantError;

      const conversationIds = participantData?.map((p) => p.conversation_id) || [];
      if (conversationIds.length === 0) return [];

      // Get conversations
      const { data: conversationsData, error: conversationsError } = await supabase
        .from('conversations')
        .select('id, created_at, updated_at')
        .in('id', conversationIds)
        .order('updated_at', { ascending: false });

      if (conversationsError) throw conversationsError;

      // Get all participants for these conversations
      const { data: allParticipants, error: allParticipantsError } = await supabase
        .from('conversation_participants')
        .select('conversation_id, user_id')
        .in('conversation_id', conversationIds);

      if (allParticipantsError) throw allParticipantsError;

      // Get all user profiles
      const userIds = [...new Set(allParticipants?.map((p) => p.user_id) || [])];
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, user_id, username, display_name, avatar_url')
        .in('user_id', userIds);

      if (profilesError) throw profilesError;

      // Create a map of user_id to profile
      const profileMap = new Map(profiles?.map((p) => [p.user_id, p]) || []);

      // Combine data
      return (conversationsData || []).map((conv) => ({
        ...conv,
        participants: (allParticipants || [])
          .filter((p) => p.conversation_id === conv.id)
          .map((p) => ({
            user_id: p.user_id,
            profiles: profileMap.get(p.user_id) || {
              id: '',
              username: 'Unknown',
              display_name: null,
              avatar_url: null,
            },
          })),
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

      // Generate a conversation ID first
      const conversationId = crypto.randomUUID();

      // Create the conversation first (INSERT has permissive policy)
      const { error: convError } = await supabase
        .from('conversations')
        .insert({ id: conversationId });

      if (convError) throw convError;

      // Add current user as participant first (allows user_id = auth.uid())
      const { error: selfPartError } = await supabase
        .from('conversation_participants')
        .insert({ conversation_id: conversationId, user_id: user.id });

      if (selfPartError) throw selfPartError;

      // Now add the other participant (allowed because current user is already a participant)
      const { error: otherPartError } = await supabase
        .from('conversation_participants')
        .insert({ conversation_id: conversationId, user_id: profile.user_id });

      if (otherPartError) throw otherPartError;

      // Generate and store encryption key in the database and locally
      const key = await generateKey();
      const keyString = await exportKey(key);
      await supabase
        .from('conversations')
        .update({ encryption_key: keyString })
        .eq('id', conversationId);
      storeConversationKey(conversationId, keyString);

      return { id: conversationId };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
  });

  const deleteConversation = useMutation({
    mutationFn: async (conversationId: string) => {
      if (!user) throw new Error('Not authenticated');

      // Delete messages first
      await supabase
        .from('messages')
        .delete()
        .eq('conversation_id', conversationId);

      // Delete participants
      await supabase
        .from('conversation_participants')
        .delete()
        .eq('conversation_id', conversationId);

      // Delete conversation
      const { error } = await supabase
        .from('conversations')
        .delete()
        .eq('id', conversationId);

      if (error) throw error;
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
    deleteConversation,
  };
}
