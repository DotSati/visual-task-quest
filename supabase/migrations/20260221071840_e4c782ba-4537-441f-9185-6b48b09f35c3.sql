
-- Add notification datetime and sent flag to tasks
ALTER TABLE public.tasks
ADD COLUMN notification_at timestamp with time zone DEFAULT NULL,
ADD COLUMN notification_sent boolean NOT NULL DEFAULT false;

-- Add notification webhook URL to profiles
ALTER TABLE public.profiles
ADD COLUMN notification_url text DEFAULT NULL;

-- Allow users to update their own profile (needed for notification_url)
CREATE POLICY "Users can update their own profile"
ON public.profiles
FOR UPDATE
USING (auth.uid() = id);
