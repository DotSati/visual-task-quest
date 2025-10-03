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
};

export function KanbanColumn({ column, tasks, onAddTask, onTaskUpdate, onColumnDelete }: KanbanColumnProps) {
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
    <div ref={setNodeRef} className="kanban-column min-w-[300px] max-w-[300px] flex-shrink-0">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-semibold text-lg">{column.title}</h3>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={onAddTask}>
            <Plus className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={deleteColumn}>
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <SortableContext items={tasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-2">
          {tasks.map((task) => (
            <TaskCard key={task.id} task={task} onUpdate={onTaskUpdate} />
          ))}
        </div>
      </SortableContext>

      {tasks.length === 0 && (
        <div className="text-center py-8 text-muted-foreground text-sm">
          No tasks yet
        </div>
      )}
    </div>
  );
}
