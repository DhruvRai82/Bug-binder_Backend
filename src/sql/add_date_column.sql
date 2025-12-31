
-- Add missing 'date' column to project_pages
-- Frontend relies on this being a string (YYYY-MM-DD)

ALTER TABLE public.project_pages 
ADD COLUMN IF NOT EXISTS date TEXT;

-- Verify it exists
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'project_pages' AND column_name = 'date';
