import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { TaskEditDialog } from "./TaskEditDialog";
import { Calendar, Paperclip } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type Subtask = {
  id: string;
  title: string;
  description: string | null;
  is_completed: boolean;
  position: number;
  task_id: string;
};

type Task = {
  id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  position: number;
  column_id: string;
  subtasks?: Subtask[];
};

type TaskCardProps = {
  task: Task;
  onUpdate: () => void;
  onClick?: () => void;
};

export function TaskCard({ task, onUpdate, onClick }: TaskCardProps) {
  const [attachmentCount, setAttachmentCount] = useState(0);
  
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  useEffect(() => {
    loadAttachmentCount();
  }, [task.id]);

  const loadAttachmentCount = async () => {
    const { count } = await supabase
      .from("task_attachments")
      .select("*", { count: 'exact', head: true })
      .eq("task_id", task.id);
    
    setAttachmentCount(count || 0);
  };

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const completedSubtasks = task.subtasks?.filter(st => st.is_completed).length || 0;
  const totalSubtasks = task.subtasks?.length || 0;

  return (
    <Card
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="kanban-task"
      onClick={onClick}
    >
      <CardHeader className="p-2 pb-1.5">
        <CardTitle className="text-xs font-medium leading-tight line-clamp-2">{task.title}</CardTitle>
      </CardHeader>
      {(task.due_date || totalSubtasks > 0 || attachmentCount > 0) && (
        <CardContent className="p-2 pt-0 flex items-center gap-3 text-[11px]">
          {task.due_date && (
            <div className="flex items-center gap-1 text-muted-foreground">
              <Calendar className="w-3 h-3" />
              <span>{new Date(task.due_date).toLocaleDateString()}</span>
            </div>
          )}
          {totalSubtasks > 0 && (
            <div className="text-muted-foreground">
              {completedSubtasks}/{totalSubtasks}
            </div>
          )}
          {attachmentCount > 0 && (
            <div className="flex items-center gap-1 text-muted-foreground">
              <Paperclip className="w-3 h-3" />
              <span>{attachmentCount}</span>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
