 # 🔐 Echo Secure
 
 A secure end-to-end encrypted (E2EE) real-time messaging application built with React, TypeScript, and Supabase.
 
 ---
 
 ## 📋 Table of Contents
 
 - [Overview](#overview)
 - [Features](#features)
 - [Technology Stack](#technology-stack)
 - [Architecture](#architecture)
 - [Database Schema](#database-schema)
 - [Security Implementation](#security-implementation)
 - [Authentication Flow](#authentication-flow)
 - [Core Components](#core-components)
 - [Hooks API Reference](#hooks-api-reference)
 - [Real-time Features](#real-time-features)
 - [File Storage](#file-storage)
 - [Project Structure](#project-structure)
 
 ---
 
 ## Overview
 
 Echo Secure is a privacy-focused messaging application that implements true end-to-end encryption. Messages are encrypted on the sender's device and can only be decrypted by the recipient. The server never has access to message content in plaintext.
 
 ---
 
 ## Features
 
 ### ✅ Authentication
 - User registration with username/password
 - Secure password hashing (bcrypt via Supabase Auth)
 - JWT-based session management
 - Automatic profile creation on signup
 
 ### 💬 Messaging
 - Real-time private conversations
 - End-to-end encrypted messages (AES-256-GCM)
 - Message read receipts (✓ sent, ✓✓ read)
 - Real-time typing indicators
 - Message history with pagination
 
 ### 👤 User Profiles
 - Customizable display names
 - Avatar image uploads (2MB limit)
 - Username-based user discovery
 
 ### 🔐 Security
 - Client-side AES-256-GCM encryption
 - Keys never transmitted to server
 - Row-Level Security (RLS) on all tables
 - Secure file uploads with owner-only policies
 
 ---
 
 ## Technology Stack
 
 ### Frontend
 | Technology | Purpose |
 |------------|---------|
 | React 18 | UI framework |
 | TypeScript | Type safety |
 | Vite | Build tool |
 | Tailwind CSS | Styling |
 | shadcn/ui | Component library |
 | Framer Motion | Animations |
 | TanStack Query | Server state management |
 | React Router | Client-side routing |
 
 ### Backend (Lovable Cloud)
 | Technology | Purpose |
 |------------|---------|
 | Supabase Auth | Authentication |
 | PostgreSQL | Database |
 | Supabase Realtime | WebSocket subscriptions |
 | Supabase Storage | File storage |
 
 ### Encryption
 | Technology | Purpose |
 |------------|---------|
 | Web Crypto API | Native browser cryptography |
 | AES-256-GCM | Symmetric encryption |
 
 ---
 
 ## Architecture
 
 ```
 ┌─────────────────────────────────────────────────────────────┐
 │                      Client (Browser)                       │
 ├─────────────────────────────────────────────────────────────┤
 │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
 │  │   React     │  │  Encryption │  │   Local Storage     │  │
 │  │   Components│  │   Layer     │  │   (Crypto Keys)     │  │
 │  └──────┬──────┘  └──────┬──────┘  └─────────────────────┘  │
 │         │                │                                   │
 │         └────────┬───────┘                                   │
 │                  ▼                                           │
 │         ┌───────────────┐                                    │
 │         │ Supabase SDK  │                                    │
 │         └───────┬───────┘                                    │
 └─────────────────┼───────────────────────────────────────────┘
                   │ HTTPS/WSS
                   ▼
 ┌─────────────────────────────────────────────────────────────┐
 │                   Lovable Cloud Backend                     │
 ├─────────────────────────────────────────────────────────────┤
 │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
 │  │  Supabase   │  │  PostgreSQL │  │   Supabase          │  │
 │  │  Auth       │  │  + RLS      │  │   Realtime          │  │
 │  └─────────────┘  └─────────────┘  └─────────────────────┘  │
 │                                                              │
 │  ┌─────────────────────────────────────────────────────────┐│
 │  │                 Supabase Storage                        ││
 │  │                 (Avatar Bucket)                         ││
 │  └─────────────────────────────────────────────────────────┘│
 └─────────────────────────────────────────────────────────────┘
 ```
 
 ---
 
 ## Database Schema
 
 ### Tables
 
 #### `profiles`
 Stores user profile information.
 
 | Column | Type | Description |
 |--------|------|-------------|
 | id | UUID | Primary key |
 | user_id | UUID | References auth.users |
 | username | TEXT | Unique username |
 | display_name | TEXT | Optional display name |
 | avatar_url | TEXT | URL to avatar image |
 | public_key | TEXT | Reserved for future RSA implementation |
 | created_at | TIMESTAMP | Creation timestamp |
 | updated_at | TIMESTAMP | Last update timestamp |
 
 #### `conversations`
 Stores conversation metadata.
 
 | Column | Type | Description |
 |--------|------|-------------|
 | id | UUID | Primary key |
 | created_at | TIMESTAMP | Creation timestamp |
 | updated_at | TIMESTAMP | Last activity timestamp |
 
 #### `conversation_participants`
 Junction table for conversation membership.
 
 | Column | Type | Description |
 |--------|------|-------------|
 | id | UUID | Primary key |
 | conversation_id | UUID | References conversations |
 | user_id | UUID | Participant user ID |
 | joined_at | TIMESTAMP | Join timestamp |
 
 #### `messages`
 Stores encrypted messages.
 
 | Column | Type | Description |
 |--------|------|-------------|
 | id | UUID | Primary key |
 | conversation_id | UUID | References conversations |
 | sender_id | UUID | Message sender |
 | encrypted_content | TEXT | Base64-encoded ciphertext |
 | iv | TEXT | Base64-encoded initialization vector |
 | read_at | TIMESTAMP | When recipient read the message |
 | created_at | TIMESTAMP | Send timestamp |
 
 #### `typing_indicators`
 Real-time typing status.
 
 | Column | Type | Description |
 |--------|------|-------------|
 | id | UUID | Primary key |
 | conversation_id | UUID | References conversations |
 | user_id | UUID | Typing user |
 | is_typing | BOOLEAN | Current typing state |
 | updated_at | TIMESTAMP | Last update |
 
 ### Database Functions
 
 #### `is_conversation_participant(conversation_id, user_id)`
 Security definer function that checks if a user is a participant in a conversation. Used by RLS policies to prevent infinite recursion.
 
 ```sql
 CREATE OR REPLACE FUNCTION public.is_conversation_participant(
   _conversation_id uuid, 
   _user_id uuid
 )
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
 AS $$
   SELECT EXISTS (
     SELECT 1
     FROM public.conversation_participants
     WHERE conversation_id = _conversation_id
       AND user_id = _user_id
   )
 $$;
 ```
 
 ---
 
 ## Security Implementation
 
 ### End-to-End Encryption
 
 Messages are encrypted using **AES-256-GCM** via the Web Crypto API:
 
 1. **Key Generation**: A 256-bit AES key is generated for each conversation
 2. **Key Storage**: Keys are stored in browser localStorage (never sent to server)
 3. **Encryption**: Each message is encrypted with a unique 12-byte IV
 4. **Transmission**: Only ciphertext and IV are sent to the server
 5. **Decryption**: Recipients decrypt using the shared conversation key
 
 ### Encryption Flow
 
 ```
 Sender                          Server                         Recipient
   │                               │                               │
   │  1. Generate/Load Key         │                               │
   │  2. Encrypt(message, key)     │                               │
   │  ─────────────────────────────>                               │
   │     {encrypted_content, iv}   │                               │
   │                               │  3. Store ciphertext          │
   │                               │  ─────────────────────────────>
   │                               │     {encrypted_content, iv}   │
   │                               │                               │
   │                               │                 4. Load Key   │
   │                               │     5. Decrypt(ciphertext, key)
   │                               │                               │
 ```
 
 ### Row-Level Security (RLS)
 
 All tables have RLS enabled with policies ensuring:
 
 - **Profiles**: Users can view all profiles, update only their own
 - **Conversations**: Only participants can view/modify
 - **Messages**: Only conversation participants can read/write
 - **Typing Indicators**: Only participants can view/update
 
 ---
 
 ## Authentication Flow
 
 ### Registration
 
 1. User enters username and password
 2. System creates auth account with email: `{username}@echosecure.local`
 3. Password is hashed with bcrypt (handled by Supabase Auth)
 4. Database trigger creates profile with generated username
 5. User receives JWT session token
 
 ### Login
 
 1. User enters username and password
 2. System authenticates via `{username}@echosecure.local`
 3. On success, JWT is stored in browser
 4. Profile data is fetched for the session
 
 ---
 
 ## Core Components
 
 ### Pages
 
 | Component | Path | Description |
 |-----------|------|-------------|
 | `Chat.tsx` | `/chat` | Main messaging interface |
 | `NotFound.tsx` | `*` | 404 error page |
 
 ### Chat Components
 
 | Component | Description |
 |-----------|-------------|
 | `ChatView.tsx` | Message display and input area |
 | `ConversationList.tsx` | Sidebar with conversation list |
 | `UserSearchDialog.tsx` | Search and start new conversations |
 | `TypingIndicator.tsx` | Animated typing dots |
 
 ### Profile Components
 
 | Component | Description |
 |-----------|-------------|
 | `ProfileSettings.tsx` | Display name and avatar management |
 
 ### Auth Components
 
 | Component | Description |
 |-----------|-------------|
 | `AuthForm.tsx` | Login/registration form |
 
 ---
 
 ## Hooks API Reference
 
 ### `useAuth()`
 Authentication context hook.
 
 ```typescript
 const { user, signIn, signUp, signOut, loading } = useAuth();
 ```
 
 | Property | Type | Description |
 |----------|------|-------------|
 | user | User \| null | Current authenticated user |
 | signIn | (email, password) => Promise | Login function |
 | signUp | (email, password) => Promise | Registration function |
 | signOut | () => Promise | Logout function |
 | loading | boolean | Auth state loading |
 
 ### `useProfile()`
 User profile management.
 
 ```typescript
 const { profile, isLoading, updateProfile, uploadAvatar } = useProfile();
 ```
 
 | Property | Type | Description |
 |----------|------|-------------|
 | profile | Profile \| null | Current user profile |
 | isLoading | boolean | Loading state |
 | updateProfile | (data) => Promise | Update profile fields |
 | uploadAvatar | (file) => Promise | Upload avatar image |
 
 ### `useConversations()`
 Conversation list management.
 
 ```typescript
 const { 
   conversations, 
   isLoading, 
   createConversation, 
   deleteConversation 
 } = useConversations();
 ```
 
 | Property | Type | Description |
 |----------|------|-------------|
 | conversations | Conversation[] | User's conversations |
 | isLoading | boolean | Loading state |
 | createConversation | (username) => Promise | Start new conversation |
 | deleteConversation | (id) => Promise | Remove conversation |
 
 ### `useMessages(conversationId)`
 Message handling with encryption.
 
 ```typescript
 const { 
   messages, 
   isLoading, 
   sendMessage, 
   isEncryptionReady 
 } = useMessages(conversationId);
 ```
 
 | Property | Type | Description |
 |----------|------|-------------|
 | messages | Message[] | Decrypted messages |
 | isLoading | boolean | Loading state |
 | sendMessage | (content) => Promise | Send encrypted message |
 | isEncryptionReady | boolean | Encryption key loaded |
 
 ### `useTypingIndicator(conversationId)`
 Real-time typing status.
 
 ```typescript
 const { 
   isTyping, 
   typingUsers, 
   setTyping 
 } = useTypingIndicator(conversationId);
 ```
 
 | Property | Type | Description |
 |----------|------|-------------|
 | isTyping | boolean | Current user typing |
 | typingUsers | string[] | Users currently typing |
 | setTyping | (typing) => void | Update typing state |
 
 ### `useUserSearch()`
 User discovery.
 
 ```typescript
 const { 
   searchResults, 
   isSearching, 
   searchUsers 
 } = useUserSearch();
 ```
 
 | Property | Type | Description |
 |----------|------|-------------|
 | searchResults | Profile[] | Matching users |
 | isSearching | boolean | Search in progress |
 | searchUsers | (query) => void | Trigger search |
 
 ---
 
 ## Real-time Features
 
 ### Message Subscriptions
 
 Messages are received in real-time via Supabase Realtime:
 
 ```typescript
 supabase
   .channel(`messages:${conversationId}`)
   .on('postgres_changes', {
     event: 'INSERT',
     schema: 'public',
     table: 'messages',
     filter: `conversation_id=eq.${conversationId}`,
   }, handleNewMessage)
   .subscribe();
 ```
 
 ### Typing Indicators
 
 Typing status is broadcast in real-time:
 
 - User starts typing → `is_typing: true` upserted
 - User stops typing (debounced) → `is_typing: false` upserted
 - Other participants receive updates via Realtime subscription
 
 ### Read Receipts
 
 Message read status is tracked:
 
 - **Single check (✓)**: Message sent successfully
 - **Double check (✓✓)**: Message read by recipient
 - `read_at` timestamp is set when recipient views the message
 
 ---
 
 ## File Storage
 
 ### Avatar Bucket
 
 User avatars are stored in the `avatars` Supabase Storage bucket:
 
 - **Bucket**: `avatars` (public)
 - **Max Size**: 2MB
 - **Allowed Types**: image/*
 - **Path Pattern**: `{user_id}/{filename}`
 
 ### Storage Policies
 
 - **SELECT**: Public (anyone can view avatars)
 - **INSERT**: Authenticated users (own folder only)
 - **UPDATE**: Owner only
 - **DELETE**: Owner only
 
 ---
 
 ## Project Structure
 
 ```
 src/
 ├── components/
 │   ├── auth/
 │   │   └── AuthForm.tsx          # Login/signup form
 │   ├── chat/
 │   │   ├── ChatView.tsx          # Message display
 │   │   ├── ConversationList.tsx  # Conversation sidebar
 │   │   ├── TypingIndicator.tsx   # Typing animation
 │   │   └── UserSearchDialog.tsx  # New conversation dialog
 │   ├── profile/
 │   │   └── ProfileSettings.tsx   # Profile management
 │   └── ui/                       # shadcn/ui components
 ├── contexts/
 │   └── AuthContext.tsx           # Authentication provider
 ├── hooks/
 │   ├── useConversations.ts       # Conversation management
 │   ├── useMessages.ts            # Message handling + encryption
 │   ├── useProfile.ts             # Profile operations
 │   ├── useTypingIndicator.ts     # Typing status
 │   └── useUserSearch.ts          # User discovery
 ├── lib/
 │   ├── encryption.ts             # AES-256-GCM utilities
 │   └── utils.ts                  # Helper functions
 ├── pages/
 │   ├── Chat.tsx                  # Main chat page
 │   └── NotFound.tsx              # 404 page
 └── integrations/
     └── supabase/
         ├── client.ts             # Supabase client instance
         └── types.ts              # Generated database types
 ```
 
 ---
 
 ## Environment Variables
 
 The following environment variables are automatically configured:
 
 | Variable | Description |
 |----------|-------------|
 | VITE_SUPABASE_URL | Backend API URL |
 | VITE_SUPABASE_PUBLISHABLE_KEY | Public API key |
 | VITE_SUPABASE_PROJECT_ID | Project identifier |
 
 ---
 
 ## Security Considerations
 
 ### Current Implementation
 
 ✅ **Implemented**:
 - AES-256-GCM encryption for all messages
 - RLS policies on all database tables
 - Secure password hashing (bcrypt)
 - JWT-based session management
 - Owner-only file upload policies
 
 ### Future Enhancements
 
 🔄 **Planned**:
 - RSA key exchange for cross-device key sharing
 - Message expiration/auto-delete
 - Two-factor authentication (2FA)
 - Device verification
 - Message forward secrecy
 
 ---
 
 