import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import {
  encryptMessage,
  decryptMessage,
  importKey,
  getConversationKey,
  generateKey,
  exportKey,
  storeConversationKey,
} from '@/lib/encryption';

interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  encrypted_content: string;
  iv: string;
  created_at: string;
  decrypted_content?: string;
}

export function useMessages(conversationId: string | null) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [encryptionKey, setEncryptionKey] = useState<CryptoKey | null>(null);

  // Initialize or load encryption key for this conversation from database
  useEffect(() => {
    async function initKey() {
      if (!conversationId) return;

      // First check localStorage cache
      const cachedKey = getConversationKey(conversationId);
      if (cachedKey) {
        const key = await importKey(cachedKey);
        setEncryptionKey(key);
        return;
      }

      // Fetch from database
      const { data } = await supabase
        .from('conversations')
        .select('encryption_key')
        .eq('id', conversationId)
        .single();

      if (data?.encryption_key) {
        // Use the shared key from the database
        storeConversationKey(conversationId, data.encryption_key);
        const key = await importKey(data.encryption_key);
        setEncryptionKey(key);
      } else {
        // Generate a new key and store it in the database
        const key = await generateKey();
        const keyString = await exportKey(key);
        await supabase
          .from('conversations')
          .update({ encryption_key: keyString })
          .eq('id', conversationId);
        storeConversationKey(conversationId, keyString);
        setEncryptionKey(key);
      }
    }
    initKey();
  }, [conversationId]);

  const query = useQuery({
    queryKey: ['messages', conversationId],
    queryFn: async () => {
      if (!conversationId || !encryptionKey) return [];

      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Decrypt messages
      const decryptedMessages = await Promise.all(
        (data || []).map(async (msg: Message) => {
          try {
            const decrypted = await decryptMessage(
              msg.encrypted_content,
              msg.iv,
              encryptionKey
            );
            return { ...msg, decrypted_content: decrypted };
          } catch {
            return { ...msg, decrypted_content: '[Unable to decrypt]' };
          }
        })
      );

      return decryptedMessages;
    },
    enabled: !!conversationId && !!encryptionKey,
  });

  // Subscribe to real-time updates
  useEffect(() => {
    if (!conversationId) return;

    const channel = supabase
      .channel(`messages:${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['messages', conversationId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, queryClient]);

  const sendMessage = useMutation({
    mutationFn: async (content: string) => {
      if (!user || !conversationId || !encryptionKey) {
        throw new Error('Not ready to send messages');
      }

      const { encrypted, iv } = await encryptMessage(content, encryptionKey);

      const { error } = await supabase.from('messages').insert({
        conversation_id: conversationId,
        sender_id: user.id,
        encrypted_content: encrypted,
        iv: iv,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages', conversationId] });
    },
  });

  return {
    messages: query.data || [],
    isLoading: query.isLoading,
    error: query.error,
    sendMessage,
    isEncryptionReady: !!encryptionKey,
  };
}
