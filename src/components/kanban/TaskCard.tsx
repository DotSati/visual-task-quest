import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { TaskEditDialog } from "./TaskEditDialog";
import { Calendar } from "lucide-react";

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
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

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
        {task.description && (
          <CardDescription className="text-[11px] line-clamp-1 mt-1">
            {task.description}
          </CardDescription>
        )}
      </CardHeader>
      {(task.due_date || totalSubtasks > 0) && (
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
        </CardContent>
      )}
    </Card>
  );
}
