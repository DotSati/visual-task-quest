-- Add task_number column to tasks table
ALTER TABLE public.tasks
ADD COLUMN task_number INTEGER;

-- Create a function to get the next task number for a user
CREATE OR REPLACE FUNCTION public.get_next_task_number(p_user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  next_number INTEGER;
BEGIN
  SELECT COALESCE(MAX(t.task_number), 0) + 1
  INTO next_number
  FROM tasks t
  JOIN columns c ON c.id = t.column_id
  JOIN boards b ON b.id = c.board_id
  WHERE b.user_id = p_user_id;
  
  RETURN next_number;
END;
$$;

-- Create a trigger function to auto-assign task numbers
CREATE OR REPLACE FUNCTION public.assign_task_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  board_user_id UUID;
BEGIN
  -- Get the user_id from the board
  SELECT b.user_id INTO board_user_id
  FROM columns c
  JOIN boards b ON b.id = c.board_id
  WHERE c.id = NEW.column_id;
  
  -- Assign the next task number
  NEW.task_number := get_next_task_number(board_user_id);
  
  RETURN NEW;
END;
$$;

-- Create trigger to auto-assign task numbers on insert
CREATE TRIGGER set_task_number_on_insert
BEFORE INSERT ON public.tasks
FOR EACH ROW
EXECUTE FUNCTION assign_task_number();

-- Backfill existing tasks with task numbers
DO $$
DECLARE
  user_record RECORD;
  task_record RECORD;
  current_number INTEGER;
BEGIN
  -- For each user
  FOR user_record IN 
    SELECT DISTINCT b.user_id 
    FROM boards b
  LOOP
    current_number := 1;
    
    -- Assign numbers to their tasks in creation order
    FOR task_record IN
      SELECT t.id
      FROM tasks t
      JOIN columns c ON c.id = t.column_id
      JOIN boards b ON b.id = c.board_id
      WHERE b.user_id = user_record.user_id
      AND t.task_number IS NULL
      ORDER BY t.created_at
    LOOP
      UPDATE tasks
      SET task_number = current_number
      WHERE id = task_record.id;
      
      current_number := current_number + 1;
    END LOOP;
  END LOOP;
END $$;