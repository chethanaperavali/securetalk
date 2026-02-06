
-- Allow participants to update their conversations (needed to store encryption key)
CREATE POLICY "Users can update their conversations"
ON public.conversations
FOR UPDATE
USING (is_conversation_participant(id, auth.uid()))
WITH CHECK (is_conversation_participant(id, auth.uid()));

-- Allow participants to update their own messages (for editing)
CREATE POLICY "Users can update their own messages"
ON public.messages
FOR UPDATE
USING (sender_id = auth.uid() AND is_conversation_participant(conversation_id, auth.uid()))
WITH CHECK (sender_id = auth.uid() AND is_conversation_participant(conversation_id, auth.uid()));

-- Add edited_at column to messages for tracking edits
ALTER TABLE public.messages ADD COLUMN edited_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;
