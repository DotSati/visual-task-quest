-- Create storage bucket for task files
INSERT INTO storage.buckets (id, name, public)
VALUES ('task-files', 'task-files', false);

-- Create task_attachments table
CREATE TABLE public.task_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  mime_type TEXT,
  uploaded_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.task_attachments ENABLE ROW LEVEL SECURITY;

-- RLS policies for task_attachments
CREATE POLICY "Users can view attachments of their tasks"
ON public.task_attachments
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM tasks
    JOIN columns ON columns.id = tasks.column_id
    JOIN boards ON boards.id = columns.board_id
    WHERE tasks.id = task_attachments.task_id
    AND boards.user_id = auth.uid()
  )
);

CREATE POLICY "Users can upload attachments to their tasks"
ON public.task_attachments
FOR INSERT
WITH CHECK (
  auth.uid() = uploaded_by
  AND EXISTS (
    SELECT 1
    FROM tasks
    JOIN columns ON columns.id = tasks.column_id
    JOIN boards ON boards.id = columns.board_id
    WHERE tasks.id = task_attachments.task_id
    AND boards.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete attachments from their tasks"
ON public.task_attachments
FOR DELETE
USING (
  EXISTS (
    SELECT 1
    FROM tasks
    JOIN columns ON columns.id = tasks.column_id
    JOIN boards ON boards.id = columns.board_id
    WHERE tasks.id = task_attachments.task_id
    AND boards.user_id = auth.uid()
  )
);

-- Storage policies for task-files bucket
CREATE POLICY "Users can view files from their tasks"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'task-files'
  AND EXISTS (
    SELECT 1
    FROM task_attachments
    JOIN tasks ON tasks.id = task_attachments.task_id
    JOIN columns ON columns.id = tasks.column_id
    JOIN boards ON boards.id = columns.board_id
    WHERE storage.objects.name = task_attachments.file_path
    AND boards.user_id = auth.uid()
  )
);

CREATE POLICY "Users can upload files to their tasks"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'task-files'
  AND auth.uid() IS NOT NULL
);

CREATE POLICY "Users can delete files from their tasks"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'task-files'
  AND EXISTS (
    SELECT 1
    FROM task_attachments
    JOIN tasks ON tasks.id = task_attachments.task_id
    JOIN columns ON columns.id = tasks.column_id
    JOIN boards ON boards.id = columns.board_id
    WHERE storage.objects.name = task_attachments.file_path
    AND boards.user_id = auth.uid()
  )
);

-- Create index for faster lookups
CREATE INDEX idx_task_attachments_task_id ON public.task_attachments(task_id);