-- 1. Create a function that runs when a new user signs up via Supabase Auth
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, username, created_at, role, status)
  VALUES (
    new.id, 
    new.email, 
    COALESCE(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    new.created_at,
    'user', 
    'active'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Create the Trigger on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 3. ONE-TIME BACKFILL (Again, to be safe)
INSERT INTO public.users (id, email, created_at, role, status, username)
SELECT 
    id, 
    email, 
    created_at, 
    'user', 
    'active',
    COALESCE(raw_user_meta_data->>'username', split_part(email, '@', 1)) 
FROM auth.users
ON CONFLICT (id) DO NOTHING;
