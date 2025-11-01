-- Update the check constraint on columns table to allow the new sort_order value
ALTER TABLE public.columns DROP CONSTRAINT IF EXISTS columns_sort_order_check;

ALTER TABLE public.columns ADD CONSTRAINT columns_sort_order_check 
CHECK (sort_order IN ('task_number_desc', 'task_number_asc', 'manual', 'due_date_priority'));