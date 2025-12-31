-- Create fs_nodes table for Web IDE
CREATE TABLE IF NOT EXISTS public.fs_nodes (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    project_id UUID NOT NULL, -- references projects(id)
    parent_id UUID REFERENCES public.fs_nodes(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    type TEXT CHECK (type IN ('file', 'folder')) NOT NULL,
    language TEXT, -- 'typescript', 'python', 'java'
    content TEXT, -- Store code content directly here
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_fs_nodes_project_parent ON public.fs_nodes(project_id, parent_id);
CREATE INDEX IF NOT EXISTS idx_fs_nodes_user ON public.fs_nodes(user_id);

-- RLS Policies (Enable Row Level Security)
ALTER TABLE public.fs_nodes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own nodes" 
ON public.fs_nodes FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own nodes" 
ON public.fs_nodes FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own nodes" 
ON public.fs_nodes FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own nodes" 
ON public.fs_nodes FOR DELETE 
USING (auth.uid() = user_id);
