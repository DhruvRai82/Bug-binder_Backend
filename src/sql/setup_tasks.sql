-- Create tasks table
CREATE TABLE IF NOT EXISTS public.tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'todo',
    label TEXT NOT NULL DEFAULT 'feature',
    priority TEXT NOT NULL DEFAULT 'medium',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

-- Create Policy (Allow all for authenticated/admin for now)
DROP POLICY IF EXISTS "Allow all for authenticated" ON public.tasks;
CREATE POLICY "Allow all for authenticated" ON public.tasks
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Insert Dummy Data for Demo
INSERT INTO public.tasks (title, status, label, priority)
VALUES 
('Fix Login Bug', 'in_progress', 'bug', 'high'),
('Update Documentation', 'todo', 'documentation', 'low'),
('Add New Feature', 'backlog', 'feature', 'medium');
