-- Add tags column to tasks table
ALTER TABLE tasks ADD COLUMN tags text[] DEFAULT ARRAY[]::text[];

-- Add index for better performance when filtering by tags
CREATE INDEX idx_tasks_tags ON tasks USING GIN(tags);