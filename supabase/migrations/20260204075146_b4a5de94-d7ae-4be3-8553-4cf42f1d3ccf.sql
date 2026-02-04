-- Drop the existing restrictive INSERT policy
DROP POLICY IF EXISTS "Users can join conversations" ON public.conversation_participants;

-- Create a new INSERT policy that allows users to add participants to conversations they're creating
-- This allows inserting if: the user is the one being added, OR the user is already a participant in the conversation
CREATE POLICY "Users can add participants to conversations" 
ON public.conversation_participants 
FOR INSERT 
WITH CHECK (
  user_id = auth.uid() 
  OR public.is_conversation_participant(conversation_id, auth.uid())
);