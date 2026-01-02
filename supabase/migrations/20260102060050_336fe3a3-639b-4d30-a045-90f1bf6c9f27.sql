-- Drop the existing check constraint
ALTER TABLE public.columns DROP CONSTRAINT IF EXISTS columns_sort_order_check;

-- Add updated check constraint that includes the new sort order option
ALTER TABLE public.columns ADD CONSTRAINT columns_sort_order_check 
CHECK (sort_order IS NULL OR sort_order IN ('task_number_desc', 'task_number_asc', 'due_date_priority', 'manual', 'due_date_modified'));