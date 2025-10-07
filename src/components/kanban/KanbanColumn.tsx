import { Button } from "@/components/ui/button";
import { Plus, Trash2 } from "lucide-react";
import { TaskCard } from "./TaskCard";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

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
  task_number: number | null;
  color: string | null;
  subtasks?: Subtask[];
};

type Column = {
  id: string;
  title: string;
  position: number;
  board_id: string;
};

type KanbanColumnProps = {
  column: Column;
  tasks: Task[];
  onAddTask: () => void;
  onTaskUpdate: () => void;
  onColumnDelete: () => void;
  onTaskClick: (taskId: string) => void;
};

export function KanbanColumn({ column, tasks, onAddTask, onTaskUpdate, onColumnDelete, onTaskClick }: KanbanColumnProps) {
  const { setNodeRef } = useDroppable({
    id: column.id,
  });

  const deleteColumn = async () => {
    const { error } = await supabase
      .from("columns")
      .delete()
      .eq("id", column.id);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to delete column",
        variant: "destructive"
      });
    } else {
      toast({
        title: "Success",
        description: "Column deleted"
      });
      onColumnDelete();
    }
  };

  return (
    <div ref={setNodeRef} className="kanban-column min-w-[260px] max-w-[260px] flex-shrink-0">
      <div className="flex justify-between items-center mb-2.5 px-1">
        <h3 className="font-semibold text-sm truncate">{column.title}</h3>
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onAddTask}>
            <Plus className="w-3.5 h-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={deleteColumn}>
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      <SortableContext items={tasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-1.5">
          {tasks.map((task) => (
            <TaskCard 
              key={task.id} 
              task={task} 
              onUpdate={onTaskUpdate}
              onClick={() => onTaskClick(task.id)}
            />
          ))}
        </div>
      </SortableContext>

      {tasks.length === 0 && (
        <div className="text-center py-6 text-muted-foreground text-xs">
          No tasks yet
        </div>
      )}
    </div>
  );
}
