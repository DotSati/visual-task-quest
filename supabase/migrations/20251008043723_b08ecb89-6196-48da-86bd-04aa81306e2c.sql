-- Create automation_rules table for column task movement
CREATE TABLE public.automation_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  board_id UUID NOT NULL REFERENCES public.boards(id) ON DELETE CASCADE,
  source_column_id UUID NOT NULL REFERENCES public.columns(id) ON DELETE CASCADE,
  target_column_id UUID NOT NULL REFERENCES public.columns(id) ON DELETE CASCADE,
  trigger_type TEXT NOT NULL DEFAULT 'due_date_reached' CHECK (trigger_type IN ('due_date_reached')),
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.automation_rules ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for automation rules
CREATE POLICY "Users can view automation rules for their boards"
ON public.automation_rules
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM boards
    WHERE boards.id = automation_rules.board_id
    AND boards.user_id = auth.uid()
  )
);

CREATE POLICY "Users can create automation rules for their boards"
ON public.automation_rules
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM boards
    WHERE boards.id = automation_rules.board_id
    AND boards.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update automation rules for their boards"
ON public.automation_rules
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM boards
    WHERE boards.id = automation_rules.board_id
    AND boards.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete automation rules for their boards"
ON public.automation_rules
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM boards
    WHERE boards.id = automation_rules.board_id
    AND boards.user_id = auth.uid()
  )
);

-- Add updated_at trigger
CREATE TRIGGER update_automation_rules_updated_at
BEFORE UPDATE ON public.automation_rules
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add indexes
CREATE INDEX idx_automation_rules_board_id ON public.automation_rules(board_id);
CREATE INDEX idx_automation_rules_enabled ON public.automation_rules(enabled) WHERE enabled = true;