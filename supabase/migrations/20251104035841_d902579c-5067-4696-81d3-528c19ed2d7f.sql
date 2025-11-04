-- Create task_comments table
CREATE TABLE public.task_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID NOT NULL,
  user_id UUID NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.task_comments ENABLE ROW LEVEL SECURITY;

-- Create policies for task_comments
CREATE POLICY "Users can view comments on their tasks"
ON public.task_comments
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM tasks
    JOIN columns ON columns.id = tasks.column_id
    JOIN boards ON boards.id = columns.board_id
    WHERE tasks.id = task_comments.task_id
    AND boards.user_id = auth.uid()
  )
);

CREATE POLICY "Users can create comments on their tasks"
ON public.task_comments
FOR INSERT
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1
    FROM tasks
    JOIN columns ON columns.id = tasks.column_id
    JOIN boards ON boards.id = columns.board_id
    WHERE tasks.id = task_comments.task_id
    AND boards.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update their own comments"
ON public.task_comments
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own comments"
ON public.task_comments
FOR DELETE
USING (auth.uid() = user_id);

-- Add trigger for automatic timestamp updates
CREATE TRIGGER update_task_comments_updated_at
BEFORE UPDATE ON public.task_comments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create comment_attachments table
CREATE TABLE public.comment_attachments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  comment_id UUID NOT NULL,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  mime_type TEXT,
  uploaded_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.comment_attachments ENABLE ROW LEVEL SECURITY;

-- Create policies for comment_attachments
CREATE POLICY "Users can view attachments on their comments"
ON public.comment_attachments
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM task_comments
    JOIN tasks ON tasks.id = task_comments.task_id
    JOIN columns ON columns.id = tasks.column_id
    JOIN boards ON boards.id = columns.board_id
    WHERE task_comments.id = comment_attachments.comment_id
    AND boards.user_id = auth.uid()
  )
);

CREATE POLICY "Users can upload attachments to their comments"
ON public.comment_attachments
FOR INSERT
WITH CHECK (
  auth.uid() = uploaded_by
  AND EXISTS (
    SELECT 1
    FROM task_comments
    JOIN tasks ON tasks.id = task_comments.task_id
    JOIN columns ON columns.id = tasks.column_id
    JOIN boards ON boards.id = columns.board_id
    WHERE task_comments.id = comment_attachments.comment_id
    AND boards.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete attachments from their comments"
ON public.comment_attachments
FOR DELETE
USING (
  EXISTS (
    SELECT 1
    FROM task_comments
    JOIN tasks ON tasks.id = task_comments.task_id
    JOIN columns ON columns.id = tasks.column_id
    JOIN boards ON boards.id = columns.board_id
    WHERE task_comments.id = comment_attachments.comment_id
    AND boards.user_id = auth.uid()
  )
);