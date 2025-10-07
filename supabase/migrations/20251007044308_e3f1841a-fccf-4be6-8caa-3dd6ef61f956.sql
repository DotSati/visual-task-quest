-- Add color column to tasks table
ALTER TABLE public.tasks
ADD COLUMN color TEXT DEFAULT NULL;

-- Add index for faster color lookups
CREATE INDEX idx_tasks_color ON public.tasks(color) WHERE color IS NOT NULL;