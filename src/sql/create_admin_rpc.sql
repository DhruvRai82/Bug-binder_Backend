
-- Function to get admin tasks (simplified for now)
-- This allows the Admin Dashboard to fetch tasks without RLS issues if called via Service Role, 
-- or efficiently with specific logic.

CREATE OR REPLACE FUNCTION public.get_admin_tasks()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN (
        SELECT jsonb_agg(t)
        FROM (
            SELECT * FROM public.tasks
            ORDER BY created_at DESC
            LIMIT 50
        ) t
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_admin_tasks() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_admin_tasks() TO service_role;
