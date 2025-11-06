-- Create task_assignees junction table for assigning users to tasks
CREATE TABLE task_assignees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(task_id, user_id)
);

-- Enable RLS on task_assignees table
ALTER TABLE task_assignees ENABLE ROW LEVEL SECURITY;

-- RLS policies for task_assignees
CREATE POLICY "Users can view task assignees for their tasks"
  ON task_assignees FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM tasks
      JOIN columns ON columns.id = tasks.column_id
      JOIN boards ON boards.id = columns.board_id
      WHERE tasks.id = task_assignees.task_id
        AND boards.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can assign people to their tasks"
  ON task_assignees FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tasks
      JOIN columns ON columns.id = tasks.column_id
      JOIN boards ON boards.id = columns.board_id
      WHERE tasks.id = task_assignees.task_id
        AND boards.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can remove assignees from their tasks"
  ON task_assignees FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM tasks
      JOIN columns ON columns.id = tasks.column_id
      JOIN boards ON boards.id = columns.board_id
      WHERE tasks.id = task_assignees.task_id
        AND boards.user_id = auth.uid()
    )
  );