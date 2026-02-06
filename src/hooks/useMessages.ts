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

      // Always check the database first for the shared key
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
        // No key in DB yet — check if we have a local key to promote
        const cachedKey = getConversationKey(conversationId);
        let keyString: string;

        if (cachedKey) {
          keyString = cachedKey;
        } else {
          // Generate a brand new key
          const key = await generateKey();
          keyString = await exportKey(key);
        }

        // Store it in the database so both participants share it
        await supabase
          .from('conversations')
          .update({ encryption_key: keyString })
          .eq('id', conversationId);
        storeConversationKey(conversationId, keyString);
        const key = await importKey(keyString);
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

  const editMessage = useMutation({
    mutationFn: async ({ messageId, content }: { messageId: string; content: string }) => {
      if (!user || !encryptionKey) throw new Error('Not ready');

      const { encrypted, iv } = await encryptMessage(content, encryptionKey);

      const { error } = await supabase
        .from('messages')
        .update({
          encrypted_content: encrypted,
          iv: iv,
          edited_at: new Date().toISOString(),
        })
        .eq('id', messageId)
        .eq('sender_id', user.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages', conversationId] });
    },
  });

  const deleteMessage = useMutation({
    mutationFn: async (messageId: string) => {
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('messages')
        .delete()
        .eq('id', messageId)
        .eq('sender_id', user.id);

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
    editMessage,
    deleteMessage,
    isEncryptionReady: !!encryptionKey,
  };
}
