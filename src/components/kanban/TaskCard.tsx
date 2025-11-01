import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { TaskEditDialog } from "./TaskEditDialog";
import { Calendar, Paperclip } from "lucide-react";
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
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  
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
    opacity: isDragging ? 0.5 : 1,
  };

  const completedSubtasks = task.subtasks?.filter(st => st.is_completed).length || 0;
  const totalSubtasks = task.subtasks?.length || 0;

  return (
    <Card
      ref={setNodeRef}
      style={{
        ...style,
        borderLeft: task.color ? `4px solid ${task.color}` : undefined,
      }}
      {...attributes}
      {...listeners}
      className="kanban-task"
      onClick={onClick}
    >
      <CardHeader className="p-2 pb-1.5">
        <CardTitle className="text-xs font-medium leading-tight line-clamp-2 flex items-center gap-2">
          {task.task_number && (
            <span className="text-muted-foreground">#{task.task_number}</span>
          )}
          <span className="flex-1">{task.title}</span>
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
      </CardContent>
    </Card>
  );
}
