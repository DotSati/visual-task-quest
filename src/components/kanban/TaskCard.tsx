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
};

export function TaskCard({ task, onUpdate }: TaskCardProps) {
  const [editOpen, setEditOpen] = useState(false);
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
    <>
      <Card
        ref={setNodeRef}
        style={style}
        {...attributes}
        {...listeners}
        className="kanban-task"
        onClick={() => setEditOpen(true)}
      >
        <CardHeader className="p-3">
          <CardTitle className="text-sm font-medium">{task.title}</CardTitle>
          {task.description && (
            <CardDescription className="text-xs line-clamp-2">
              {task.description}
            </CardDescription>
          )}
        </CardHeader>
        <CardContent className="p-3 pt-0 space-y-2">
          {task.due_date && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Calendar className="w-3 h-3" />
              {new Date(task.due_date).toLocaleDateString()}
            </div>
          )}
          {totalSubtasks > 0 && (
            <div className="text-xs text-muted-foreground">
              {completedSubtasks}/{totalSubtasks} subtasks
            </div>
          )}
        </CardContent>
      </Card>

      <TaskEditDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        task={task}
        onUpdate={onUpdate}
      />
    </>
  );
}
