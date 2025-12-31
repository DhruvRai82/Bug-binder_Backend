-- Function to fetch all tasks (Bypassing potential table cache issues)
CREATE OR REPLACE FUNCTION get_admin_tasks()
RETURNS SETOF public.tasks
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public.tasks ORDER BY created_at DESC;
$$;
