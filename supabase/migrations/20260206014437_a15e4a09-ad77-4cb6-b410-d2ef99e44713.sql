
-- Add encryption_key column to conversations table to share key between participants
ALTER TABLE public.conversations ADD COLUMN encryption_key TEXT;
