-- Create users table to match Admin Dashboard expectations
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(), -- Ideally this matches auth.users.id
    email TEXT NOT NULL UNIQUE,
    username TEXT,
    first_name TEXT DEFAULT '',
    last_name TEXT DEFAULT '',
    role TEXT DEFAULT 'user', -- 'admin', 'user', etc.
    status TEXT DEFAULT 'active', -- 'active', 'invited', 'banned'
    avatar_url TEXT DEFAULT '',
    bio TEXT DEFAULT '',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Create Policy (Allow all for authenticated/admin for now)
DROP POLICY IF EXISTS "Allow all for authenticated" ON public.users;
CREATE POLICY "Allow all for authenticated" ON public.users
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Insert Dummy Data for Demo (Admin)
INSERT INTO public.users (email, username, first_name, last_name, role, status)
VALUES 
(
    'admin@test.com', 
    'admin', 
    'Admin', 
    'User', 
    'admin', 
    'active'
)
ON CONFLICT (email) DO NOTHING;

-- SYNC EXISTING USERS from Supabase Auth (auth.users)
-- This ensures users already signed up appear in the dashboard
INSERT INTO public.users (id, email, created_at, role, status, username)
SELECT 
    id, 
    email, 
    created_at, 
    'user', -- Default role
    'active', -- Default status
    COALESCE(raw_user_meta_data->>'username', split_part(email, '@', 1)) -- Try to get username from metadata, else email prefix
FROM auth.users
ON CONFLICT (email) DO UPDATE SET
    id = EXCLUDED.id; -- Ensure IDs link up if email matches
