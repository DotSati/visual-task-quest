-- Add column sorting settings to boards table
ALTER TABLE public.boards
ADD COLUMN column_sort TEXT DEFAULT 'task_number_desc' CHECK (column_sort IN ('task_number_desc', 'task_number_asc'));

-- Add index for better query performance
CREATE INDEX idx_boards_column_sort ON public.boards(column_sort);