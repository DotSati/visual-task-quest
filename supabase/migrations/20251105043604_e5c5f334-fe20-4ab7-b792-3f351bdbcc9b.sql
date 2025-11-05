-- Create tags table for reusable tags
CREATE TABLE tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  color TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id, name)
);

-- Create task_tags junction table for many-to-many relationship
CREATE TABLE task_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(task_id, tag_id)
);

-- Enable RLS on tags table
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;

-- RLS policies for tags
CREATE POLICY "Users can view their own tags"
  ON tags FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own tags"
  ON tags FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own tags"
  ON tags FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own tags"
  ON tags FOR DELETE
  USING (auth.uid() = user_id);

-- Enable RLS on task_tags table
ALTER TABLE task_tags ENABLE ROW LEVEL SECURITY;

-- RLS policies for task_tags
CREATE POLICY "Users can view task_tags for their tasks"
  ON task_tags FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM tasks
      JOIN columns ON columns.id = tasks.column_id
      JOIN boards ON boards.id = columns.board_id
      WHERE tasks.id = task_tags.task_id
        AND boards.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create task_tags for their tasks"
  ON task_tags FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tasks
      JOIN columns ON columns.id = tasks.column_id
      JOIN boards ON boards.id = columns.board_id
      WHERE tasks.id = task_tags.task_id
        AND boards.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete task_tags for their tasks"
  ON task_tags FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM tasks
      JOIN columns ON columns.id = tasks.column_id
      JOIN boards ON boards.id = columns.board_id
      WHERE tasks.id = task_tags.task_id
        AND boards.user_id = auth.uid()
    )
  );

-- Migrate existing tags from tasks.tags array to new tables
DO $$
DECLARE
  task_record RECORD;
  tag_name TEXT;
  found_tag_id UUID;
BEGIN
  FOR task_record IN 
    SELECT t.id, t.tags, b.user_id
    FROM tasks t
    JOIN columns c ON c.id = t.column_id
    JOIN boards b ON b.id = c.board_id
    WHERE t.tags IS NOT NULL AND array_length(t.tags, 1) > 0
  LOOP
    FOREACH tag_name IN ARRAY task_record.tags
    LOOP
      -- Insert tag if it doesn't exist
      INSERT INTO tags (user_id, name)
      VALUES (task_record.user_id, tag_name)
      ON CONFLICT (user_id, name) DO NOTHING;
      
      -- Get tag id
      SELECT id INTO found_tag_id
      FROM tags
      WHERE user_id = task_record.user_id AND name = tag_name;
      
      -- Link task to tag
      INSERT INTO task_tags (task_id, tag_id)
      VALUES (task_record.id, found_tag_id)
      ON CONFLICT (task_id, tag_id) DO NOTHING;
    END LOOP;
  END LOOP;
END $$;

-- Drop the old tags column from tasks table
ALTER TABLE tasks DROP COLUMN tags;