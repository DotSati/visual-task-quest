import { useDroppable } from "@dnd-kit/core";
import { Button } from "@/components/ui/button";
import { Plus, MoreVertical, Trash2, ArrowUpDown } from "lucide-react";
import { TaskCard } from "./TaskCard";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useState, useMemo } from "react";

type Column = {
  id: string;
  title: string;
  position: number;
  board_id: string;
  sort_order: string | null;
};

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

interface KanbanColumnProps {
  column: Column;
  tasks: Task[];
  onAddTask: () => void;
  onTaskUpdate: () => void;
  onColumnDelete: () => void;
  onColumnUpdate: () => void;
  onTaskClick: (taskId: string) => void;
}

export function KanbanColumn({ 
  column, 
  tasks, 
  onAddTask, 
  onTaskUpdate, 
  onColumnDelete,
  onColumnUpdate,
  onTaskClick 
}: KanbanColumnProps) {
  const { setNodeRef } = useDroppable({
    id: column.id,
  });

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const sortedTasks = useMemo(() => {
    const sortOrder = column.sort_order || 'task_number_desc';
    
    if (sortOrder === 'manual') {
      return [...tasks].sort((a, b) => a.position - b.position);
    }
    
    return [...tasks].sort((a, b) => {
      const aNum = a.task_number ?? 0;
      const bNum = b.task_number ?? 0;
      
      if (sortOrder === 'task_number_desc') {
        return bNum - aNum;
      } else {
        return aNum - bNum;
      }
    });
  }, [tasks, column.sort_order]);

  const updateSortOrder = async (sortOrder: string) => {
    const { error } = await supabase
      .from("columns")
      .update({ sort_order: sortOrder })
      .eq("id", column.id);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to update sorting",
        variant: "destructive"
      });
    } else {
      onColumnUpdate();
      toast({
        title: "Success",
        description: "Column sorting updated"
      });
    }
  };

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
      setDeleteDialogOpen(false);
    }
  };

  return (
    <>
      <div 
        ref={setNodeRef} 
        className="flex flex-col bg-card rounded-lg p-3 min-w-[280px] max-w-[280px] border"
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-foreground">{column.title}</h3>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => updateSortOrder('task_number_desc')}>
                <ArrowUpDown className="mr-2 h-4 w-4" />
                Task # (Descending) {column.sort_order === 'task_number_desc' && '✓'}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => updateSortOrder('task_number_asc')}>
                <ArrowUpDown className="mr-2 h-4 w-4" />
                Task # (Ascending) {column.sort_order === 'task_number_asc' && '✓'}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => updateSortOrder('manual')}>
                <ArrowUpDown className="mr-2 h-4 w-4" />
                Manual Order {column.sort_order === 'manual' && '✓'}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => setDeleteDialogOpen(true)}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete Column
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="space-y-2 mb-2">
          {sortedTasks.map((task) => (
            <TaskCard key={task.id} task={task} onUpdate={onTaskUpdate} onClick={() => onTaskClick(task.id)} />
          ))}
        </div>

        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-muted-foreground hover:text-foreground"
          onClick={onAddTask}
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Task
        </Button>
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Column</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this column? All tasks in this column will also be deleted. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={deleteColumn} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
