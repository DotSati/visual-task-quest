-- Remove column sorting from boards table
ALTER TABLE public.boards
DROP COLUMN IF EXISTS column_sort;

DROP INDEX IF EXISTS idx_boards_column_sort;

-- Add column sorting to columns table
ALTER TABLE public.columns
ADD COLUMN sort_order TEXT DEFAULT 'task_number_desc' CHECK (sort_order IN ('task_number_desc', 'task_number_asc', 'manual'));

-- Add index for better query performance
CREATE INDEX idx_columns_sort_order ON public.columns(sort_order);