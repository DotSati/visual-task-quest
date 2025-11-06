-- Add email column to profiles table to make user lookup easier
ALTER TABLE profiles ADD COLUMN email TEXT;

-- Update the handle_new_user function to also store the email
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (new.id, new.email);
  RETURN new;
END;
$$;

-- Backfill existing profiles with emails from auth.users
DO $$
DECLARE
  profile_record RECORD;
BEGIN
  FOR profile_record IN 
    SELECT p.id, au.email
    FROM profiles p
    JOIN auth.users au ON au.id = p.id
    WHERE p.email IS NULL
  LOOP
    UPDATE profiles
    SET email = profile_record.email
    WHERE id = profile_record.id;
  END LOOP;
END $$;