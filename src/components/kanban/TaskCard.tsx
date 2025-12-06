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
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
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
import { Calendar, Paperclip, MoreVertical, ArrowRightLeft, Trash2, MessageSquare, User, Copy } from "lucide-react";
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

type Tag = {
  id: string;
  name: string;
  color: string | null;
};

type Assignee = {
  id: string;
  user_id: string;
  email?: string;
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
  created_at?: string;
  subtasks?: Subtask[];
};

type TaskCardProps = {
  task: Task;
  onUpdate: () => void;
  onClick?: () => void;
  className?: string;
};

export function TaskCard({ task, onUpdate, onClick, className }: TaskCardProps) {
  const [attachmentCount, setAttachmentCount] = useState(0);
  const [commentCount, setCommentCount] = useState(0);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [boards, setBoards] = useState<any[]>([]);
  const [currentBoardId, setCurrentBoardId] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [tags, setTags] = useState<Tag[]>([]);
  const [assignees, setAssignees] = useState<Assignee[]>([]);
  
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
    loadTags();
    loadAssignees();
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

  const loadTags = async () => {
    const { data, error } = await supabase
      .from("task_tags")
      .select("tags(id, name, color)")
      .eq("task_id", task.id);

    if (!error && data) {
      const taskTags = data.map((tt: any) => tt.tags).filter(Boolean);
      setTags(taskTags);
    }
  };

  const loadAssignees = async () => {
    const { data, error } = await supabase
      .from("task_assignees")
      .select("id, user_id, profiles(email)")
      .eq("task_id", task.id);

    if (!error && data) {
      const assigneesWithEmail = data.map((assignee: any) => ({
        id: assignee.id,
        user_id: assignee.user_id,
        email: assignee.profiles?.email
      }));
      setAssignees(assigneesWithEmail);
    }
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
      .order("position", { ascending: true });

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
        borderColor: task.color || undefined,
        borderLeftWidth: task.color ? '4px' : undefined,
      }}
      {...attributes}
      {...listeners}
      className={cn(
        "kanban-task cursor-grab active:cursor-grabbing transition-all duration-200 group",
        task.color ? "" : "border-foreground/20",
        isDragging && "opacity-80 scale-110 shadow-2xl ring-2 ring-primary/30 z-50 -translate-y-2",
        className
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
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  navigator.clipboard.writeText(task.title);
                  toast({ title: "Copied", description: "Title copied to clipboard" });
                }}
              >
                <Copy className="mr-2 h-4 w-4" />
                Copy title
              </DropdownMenuItem>
              {task.description && (
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    navigator.clipboard.writeText(task.description!);
                    toast({ title: "Copied", description: "Description copied to clipboard" });
                  }}
                >
                  <Copy className="mr-2 h-4 w-4" />
                  Copy description
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              {boards.filter(board => board.id !== currentBoardId).length > 0 && (
                <>
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger onClick={(e) => e.stopPropagation()}>
                      <ArrowRightLeft className="mr-2 h-4 w-4" />
                      Move to board
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent onClick={(e) => e.stopPropagation()}>
                      {boards.filter(board => board.id !== currentBoardId).map((board) => (
                        <DropdownMenuItem
                          key={board.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            transferToBoard(board.id);
                          }}
                        >
                          {board.title}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                  <DropdownMenuSeparator />
                </>
              )}
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
      <CardContent className="p-2 pt-0 space-y-2">
        {tags && tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {tags.map((tag) => {
              const getContrastColor = (hexColor: string) => {
                const hex = hexColor.replace('#', '');
                const r = parseInt(hex.substr(0, 2), 16);
                const g = parseInt(hex.substr(2, 2), 16);
                const b = parseInt(hex.substr(4, 2), 16);
                const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
                return luminance > 0.5 ? '#000000' : '#ffffff';
              };
              return (
                <span
                  key={tag.id}
                  className="bg-secondary text-secondary-foreground px-1.5 py-0.5 rounded text-[10px]"
                  style={tag.color ? { backgroundColor: tag.color, color: getContrastColor(tag.color) } : undefined}
                >
                  {tag.name}
                </span>
              );
            })}
          </div>
        )}
        {assignees && assignees.length > 0 && (
          <div className="flex items-center gap-1">
            <User className="w-3 h-3 text-muted-foreground" />
            <span className="text-[10px] text-muted-foreground">
              {assignees.length} assigned
            </span>
          </div>
        )}
        <div className="flex items-center gap-3 text-[11px]">
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
        {task.created_at && (
          <span className="text-muted-foreground ml-auto">
            {format(new Date(task.created_at), "MMM d")}
          </span>
        )}
        </div>
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
