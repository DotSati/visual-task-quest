import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { TaskEditDialog } from "./TaskEditDialog";
import { Calendar, Paperclip, MoreVertical, ArrowRightLeft, Trash2, MessageSquare } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

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

type TaskCardProps = {
  task: Task;
  onUpdate: () => void;
  onClick?: () => void;
};

export function TaskCard({ task, onUpdate, onClick }: TaskCardProps) {
  const [attachmentCount, setAttachmentCount] = useState(0);
  const [commentCount, setCommentCount] = useState(0);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [boards, setBoards] = useState<any[]>([]);
  const [currentBoardId, setCurrentBoardId] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ 
    id: task.id,
    transition: {
      duration: 200,
      easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
    },
  });

  useEffect(() => {
    loadAttachmentCount();
    loadCommentCount();
    loadBoards();
  }, [task.id]);

  const loadAttachmentCount = async () => {
    const { count } = await supabase
      .from("task_attachments")
      .select("*", { count: 'exact', head: true })
      .eq("task_id", task.id);
    
    setAttachmentCount(count || 0);
  };

  const loadCommentCount = async () => {
    const { count } = await supabase
      .from("task_comments")
      .select("*", { count: 'exact', head: true })
      .eq("task_id", task.id);
    
    setCommentCount(count || 0);
  };

  const loadBoards = async () => {
    const { data: session } = await supabase.auth.getSession();
    if (!session.session?.user) return;

    // Get current board_id from the task's column
    const { data: columnData } = await supabase
      .from("columns")
      .select("board_id")
      .eq("id", task.column_id)
      .single();

    if (columnData) {
      setCurrentBoardId(columnData.board_id);
    }

    const { data, error } = await supabase
      .from("boards")
      .select("*")
      .eq("user_id", session.session.user.id)
      .order("created_at", { ascending: false });

    if (!error && data) {
      setBoards(data);
    }
  };

  const transferToBoard = async (targetBoardId: string) => {
    // Get the first column of the target board
    const { data: columns, error: columnsError } = await supabase
      .from("columns")
      .select("id")
      .eq("board_id", targetBoardId)
      .order("position")
      .limit(1);

    if (columnsError || !columns || columns.length === 0) {
      toast({
        title: "Error",
        description: "Target board has no columns",
        variant: "destructive"
      });
      return;
    }

    const { error } = await supabase
      .from("tasks")
      .update({ column_id: columns[0].id, position: 0 })
      .eq("id", task.id);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to transfer task",
        variant: "destructive"
      });
    } else {
      toast({
        title: "Success",
        description: "Task transferred successfully"
      });
      onUpdate();
    }
  };

  const deleteTask = async () => {
    const { error } = await supabase
      .from("tasks")
      .delete()
      .eq("id", task.id);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to delete task",
        variant: "destructive"
      });
    } else {
      toast({
        title: "Success",
        description: "Task deleted"
      });
      setDeleteDialogOpen(false);
      onUpdate();
    }
  };

  const updateDueDate = async (date: Date | undefined) => {
    const { error } = await supabase
      .from("tasks")
      .update({
        due_date: date ? format(date, "yyyy-MM-dd") : null
      })
      .eq("id", task.id);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to update due date",
        variant: "destructive"
      });
    } else {
      toast({
        title: "Success",
        description: date ? "Due date updated" : "Due date cleared"
      });
      setIsDatePickerOpen(false);
      onUpdate();
    }
  };

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const completedSubtasks = task.subtasks?.filter(st => st.is_completed).length || 0;
  const totalSubtasks = task.subtasks?.length || 0;

  return (
    <>
    <Card
      ref={setNodeRef}
      style={{
        ...style,
        borderLeft: task.color ? `4px solid ${task.color}` : undefined,
      }}
      {...attributes}
      {...listeners}
      className={cn(
        "kanban-task cursor-grab active:cursor-grabbing transition-all duration-200 group",
        isDragging && "opacity-80 scale-110 shadow-2xl ring-2 ring-primary/30 z-50 -translate-y-2"
      )}
      onClick={onClick}
    >
      <CardHeader className="p-2 pb-1.5">
        <CardTitle className="text-xs font-medium leading-tight line-clamp-2 flex items-center gap-2">
          {task.task_number && (
            <span className="text-muted-foreground">#{task.task_number}</span>
          )}
          <span className="flex-1">{task.title}</span>
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button
                variant="ghost"
                size="sm"
                className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <MoreVertical className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
              {boards.filter(board => board.id !== currentBoardId).map((board) => (
                <DropdownMenuItem
                  key={board.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    transferToBoard(board.id);
                  }}
                >
                  <ArrowRightLeft className="mr-2 h-4 w-4" />
                  Move to {board.title}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={(e) => {
                  e.stopPropagation();
                  setDeleteDialogOpen(true);
                }}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete Task
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-2 pt-0 flex items-center gap-3 text-[11px]">
        <Popover open={isDatePickerOpen} onOpenChange={setIsDatePickerOpen}>
          <PopoverTrigger asChild onClick={(e) => e.stopPropagation()}>
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                "h-auto p-1 flex items-center gap-1 text-[11px] font-normal hover:bg-accent",
                !task.due_date && "text-muted-foreground"
              )}
            >
              <Calendar className="w-3 h-3" />
              <span>
                {task.due_date 
                  ? new Date(task.due_date).toLocaleDateString() 
                  : "Set date"}
              </span>
            </Button>
          </PopoverTrigger>
          <PopoverContent 
            className="w-auto p-0" 
            align="start"
            onClick={(e) => e.stopPropagation()}
          >
            <CalendarComponent
              mode="single"
              selected={task.due_date ? new Date(task.due_date) : undefined}
              onSelect={updateDueDate}
              initialFocus
              className="p-3 pointer-events-auto"
            />
            {task.due_date && (
              <div className="p-2 border-t">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={(e) => {
                    e.stopPropagation();
                    updateDueDate(undefined);
                  }}
                >
                  Clear Date
                </Button>
              </div>
            )}
          </PopoverContent>
        </Popover>
        
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
        {commentCount > 0 && (
          <div className="flex items-center gap-1 text-muted-foreground">
            <MessageSquare className="w-3 h-3" />
            <span>{commentCount}</span>
          </div>
        )}
      </CardContent>
    </Card>
    
    <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
      <AlertDialogContent onClick={(e) => e.stopPropagation()}>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Task</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete this task? This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={(e) => e.stopPropagation()}>Cancel</AlertDialogCancel>
          <AlertDialogAction 
            onClick={(e) => {
              e.stopPropagation();
              deleteTask();
            }}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </>
  );
}
