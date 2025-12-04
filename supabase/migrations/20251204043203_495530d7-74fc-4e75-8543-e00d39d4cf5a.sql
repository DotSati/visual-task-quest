-- Add deleted_at column for soft delete
ALTER TABLE public.boards ADD COLUMN deleted_at timestamp with time zone DEFAULT NULL;

-- Update RLS policy for SELECT to exclude deleted boards
DROP POLICY IF EXISTS "Users can view their own boards" ON public.boards;
CREATE POLICY "Users can view their own boards" 
ON public.boards 
FOR SELECT 
USING (auth.uid() = user_id AND deleted_at IS NULL);