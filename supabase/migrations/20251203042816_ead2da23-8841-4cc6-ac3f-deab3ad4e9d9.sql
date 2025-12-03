-- Add position column to boards table
ALTER TABLE public.boards ADD COLUMN position integer;

-- Set initial positions based on created_at order (most recent first = position 0)
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at DESC) - 1 as new_position
  FROM public.boards
)
UPDATE public.boards
SET position = ranked.new_position
FROM ranked
WHERE public.boards.id = ranked.id;

-- Make position NOT NULL with default 0
ALTER TABLE public.boards ALTER COLUMN position SET NOT NULL;
ALTER TABLE public.boards ALTER COLUMN position SET DEFAULT 0;