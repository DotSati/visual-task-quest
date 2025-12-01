-- Add hidden column to tasks table
ALTER TABLE tasks ADD COLUMN hidden boolean NOT NULL DEFAULT false;

-- Add index for better performance when filtering hidden tasks
CREATE INDEX idx_tasks_hidden ON tasks(hidden) WHERE hidden = false;