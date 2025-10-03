-- Create profiles table
CREATE TABLE public.profiles (
  id UUID NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Trigger to create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id)
  VALUES (new.id);
  RETURN new;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Create boards table
CREATE TABLE public.boards (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.boards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own boards"
  ON public.boards FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own boards"
  ON public.boards FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own boards"
  ON public.boards FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own boards"
  ON public.boards FOR DELETE
  USING (auth.uid() = user_id);

-- Create columns table
CREATE TABLE public.columns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  board_id UUID NOT NULL REFERENCES public.boards(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  position INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.columns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view columns of their boards"
  ON public.columns FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.boards
    WHERE boards.id = columns.board_id AND boards.user_id = auth.uid()
  ));

CREATE POLICY "Users can create columns in their boards"
  ON public.columns FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.boards
    WHERE boards.id = columns.board_id AND boards.user_id = auth.uid()
  ));

CREATE POLICY "Users can update columns in their boards"
  ON public.columns FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.boards
    WHERE boards.id = columns.board_id AND boards.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete columns in their boards"
  ON public.columns FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.boards
    WHERE boards.id = columns.board_id AND boards.user_id = auth.uid()
  ));

-- Create tasks table
CREATE TABLE public.tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  column_id UUID NOT NULL REFERENCES public.columns(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  due_date DATE,
  position INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view tasks in their boards"
  ON public.tasks FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.columns
    JOIN public.boards ON boards.id = columns.board_id
    WHERE columns.id = tasks.column_id AND boards.user_id = auth.uid()
  ));

CREATE POLICY "Users can create tasks in their boards"
  ON public.tasks FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.columns
    JOIN public.boards ON boards.id = columns.board_id
    WHERE columns.id = tasks.column_id AND boards.user_id = auth.uid()
  ));

CREATE POLICY "Users can update tasks in their boards"
  ON public.tasks FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.columns
    JOIN public.boards ON boards.id = columns.board_id
    WHERE columns.id = tasks.column_id AND boards.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete tasks in their boards"
  ON public.tasks FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.columns
    JOIN public.boards ON boards.id = columns.board_id
    WHERE columns.id = tasks.column_id AND boards.user_id = auth.uid()
  ));

-- Create subtasks table
CREATE TABLE public.subtasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  is_completed BOOLEAN NOT NULL DEFAULT false,
  position INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.subtasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view subtasks in their boards"
  ON public.subtasks FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.tasks
    JOIN public.columns ON columns.id = tasks.column_id
    JOIN public.boards ON boards.id = columns.board_id
    WHERE tasks.id = subtasks.task_id AND boards.user_id = auth.uid()
  ));

CREATE POLICY "Users can create subtasks in their boards"
  ON public.subtasks FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.tasks
    JOIN public.columns ON columns.id = tasks.column_id
    JOIN public.boards ON boards.id = columns.board_id
    WHERE tasks.id = subtasks.task_id AND boards.user_id = auth.uid()
  ));

CREATE POLICY "Users can update subtasks in their boards"
  ON public.subtasks FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.tasks
    JOIN public.columns ON columns.id = tasks.column_id
    JOIN public.boards ON boards.id = columns.board_id
    WHERE tasks.id = subtasks.task_id AND boards.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete subtasks in their boards"
  ON public.subtasks FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.tasks
    JOIN public.columns ON columns.id = tasks.column_id
    JOIN public.boards ON boards.id = columns.board_id
    WHERE tasks.id = subtasks.task_id AND boards.user_id = auth.uid()
  ));

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add triggers for updated_at
CREATE TRIGGER update_boards_updated_at
  BEFORE UPDATE ON public.boards
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_columns_updated_at
  BEFORE UPDATE ON public.columns
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_tasks_updated_at
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_subtasks_updated_at
  BEFORE UPDATE ON public.subtasks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();