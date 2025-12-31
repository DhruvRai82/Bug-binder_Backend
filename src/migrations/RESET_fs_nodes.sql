-- 1. CLEANUP (Drop everything first)
DROP TABLE IF EXISTS public.fs_nodes CASCADE;

-- 2. CREATE TABLE (With correct types)
CREATE TABLE public.fs_nodes (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    project_id UUID NOT NULL, 
    parent_id UUID REFERENCES public.fs_nodes(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL, -- FIXED: Now TEXT, not UUID
    name TEXT NOT NULL,
    type TEXT CHECK (type IN ('file', 'folder')) NOT NULL,
    language TEXT,
    content TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. INDICES
CREATE INDEX idx_fs_nodes_project_parent ON public.fs_nodes(project_id, parent_id);
CREATE INDEX idx_fs_nodes_user ON public.fs_nodes(user_id);

-- 4. RLS POLICIES
ALTER TABLE public.fs_nodes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own nodes" 
ON public.fs_nodes FOR SELECT 
USING (auth.uid()::text = user_id);

CREATE POLICY "Users can insert their own nodes" 
ON public.fs_nodes FOR INSERT 
WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can update their own nodes" 
ON public.fs_nodes FOR UPDATE 
USING (auth.uid()::text = user_id);

CREATE POLICY "Users can delete their own nodes" 
ON public.fs_nodes FOR DELETE 
USING (auth.uid()::text = user_id);
