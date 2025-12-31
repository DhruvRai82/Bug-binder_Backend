-- Create conversations table to match Frontend ChatUser interface
CREATE TABLE IF NOT EXISTS public.conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile TEXT DEFAULT '',
    username TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    title TEXT DEFAULT '',
    messages JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

-- Create Policy (Allow all for admin/public for now, or restrictive)
-- For this template, we allow authenticated users to read/insert
CREATE POLICY "Allow all for authenticated" ON public.conversations
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Insert Dummy Data for Demo
INSERT INTO public.conversations (username, "fullName", title, messages, profile)
VALUES 
(
    'alice', 
    'Alice Smith', 
    'Frontend Developer', 
    '[
        {"sender": "Alice Smith", "message": "Hey, how is the bug fixing going?", "timestamp": "2024-01-01T10:00:00Z"},
        {"sender": "You", "message": "Its going well, just fixing the login.", "timestamp": "2024-01-01T10:05:00Z"}
    ]'::jsonb,
    'https://api.dicebear.com/7.x/avataaars/svg?seed=Alice'
),
(
    'bob', 
    'Bob Jones', 
    'Product Manager', 
    '[
        {"sender": "Bob Jones", "message": "When is the release?", "timestamp": "2024-01-02T09:00:00Z"}
    ]'::jsonb,
    'https://api.dicebear.com/7.x/avataaars/svg?seed=Bob'
);
