import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { CalendarIcon, Eye, FileEdit } from "lucide-react";
import { MarkdownRenderer } from "./MarkdownRenderer";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { z } from "zod";

const descriptionSchema = z.string().max(5000, "Description must be less than 5000 characters");

type TaskDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  columnId: string | null;
  onTaskCreated: () => void;
};

export function TaskDialog({ open, onOpenChange, columnId, onTaskCreated }: TaskDialogProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState<Date | undefined>(undefined);
  const [color, setColor] = useState("");
  const [boardColors, setBoardColors] = useState<string[]>([]);
  const [isPreviewMode, setIsPreviewMode] = useState(false);

  useEffect(() => {
    if (open && columnId) {
      loadBoardColors();
    }
  }, [open, columnId]);

  const loadBoardColors = async () => {
    if (!columnId) return;

    // Get the board_id from the column
    const { data: column } = await supabase
      .from("columns")
      .select("board_id")
      .eq("id", columnId)
      .single();

    if (column) {
      // Get all unique colors from tasks in this board
      const { data: tasks } = await supabase
        .from("tasks")
        .select("color")
        .in("column_id", 
          await supabase
            .from("columns")
            .select("id")
            .eq("board_id", column.board_id)
            .then(({ data }) => data?.map(c => c.id) || [])
        )
        .not("color", "is", null);

      if (tasks) {
        const uniqueColors = Array.from(new Set(tasks.map(t => t.color).filter(Boolean)));
        setBoardColors(uniqueColors as string[]);
      }
    }
  };

  const createTask = async () => {
    if (!title.trim() || !columnId) {
      toast({
        title: "Error",
        description: "Task title is required",
        variant: "destructive"
      });
      return;
    }

    // Validate description
    const validation = descriptionSchema.safeParse(description);
    if (!validation.success) {
      toast({
        title: "Validation Error",
        description: validation.error.errors[0].message,
        variant: "destructive"
      });
      return;
    }

    const { data: existingTasks } = await supabase
      .from("tasks")
      .select("position")
      .eq("column_id", columnId)
      .order("position", { ascending: false })
      .limit(1);

    const newPosition = existingTasks && existingTasks.length > 0 
      ? existingTasks[0].position + 1 
      : 0;

    const { error } = await supabase
      .from("tasks")
      .insert({
        column_id: columnId,
        title,
        description: description || null,
        due_date: dueDate ? format(dueDate, "yyyy-MM-dd") : null,
        color: color || null,
        position: newPosition
      });

    if (error) {
      toast({
        title: "Error",
        description: "Failed to create task",
        variant: "destructive"
      });
    } else {
      toast({
        title: "Success",
        description: "Task created"
      });
      setTitle("");
      setDescription("");
      setDueDate(undefined);
      setColor("");
      setIsPreviewMode(false);
      onOpenChange(false);
      onTaskCreated();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create New Task</DialogTitle>
          <DialogDescription>Add a new task to this column</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="task-title">Title</Label>
            <Input
              id="task-title"
              placeholder="Task title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="task-description">Description (Markdown supported)</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setIsPreviewMode(!isPreviewMode)}
              >
                {isPreviewMode ? (
                  <>
                    <FileEdit className="w-4 h-4 mr-1.5" />
                    Edit
                  </>
                ) : (
                  <>
                    <Eye className="w-4 h-4 mr-1.5" />
                    Preview
                  </>
                )}
              </Button>
            </div>
            {isPreviewMode ? (
              <div className="min-h-[100px] p-3 border rounded-md bg-muted/30">
                {description ? (
                  <MarkdownRenderer content={description} />
                ) : (
                  <p className="text-sm text-muted-foreground italic">No description</p>
                )}
              </div>
            ) : (
              <Textarea
                id="task-description"
                placeholder="Supports **bold**, *italic*, `code`, lists, and more..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="min-h-[100px] font-mono text-sm"
              />
            )}
            <p className="text-xs text-muted-foreground">
              {description.length}/5000 characters
            </p>
          </div>
          <div className="space-y-2">
            <Label>Due Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !dueDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dueDate ? format(dueDate, "PPP") : <span>Pick a date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={dueDate}
                  onSelect={setDueDate}
                  initialFocus
                  className="p-3 pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label>Task Color (Optional)</Label>
            <div className="space-y-3">
              {boardColors.length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground mb-2">Recently used colors</p>
                  <div className="flex flex-wrap gap-2">
                    {boardColors.map((boardColor) => (
                      <button
                        key={boardColor}
                        type="button"
                        onClick={() => setColor(boardColor)}
                        className="w-8 h-8 rounded border-2 transition-all hover:scale-110"
                        style={{
                          backgroundColor: boardColor,
                          borderColor: color === boardColor ? 'hsl(var(--primary))' : 'hsl(var(--border))'
                        }}
                        title={boardColor}
                      />
                    ))}
                  </div>
                </div>
              )}
              <div>
                <p className="text-xs text-muted-foreground mb-2">Choose a custom color</p>
                <div className="flex items-center gap-2">
                  <Input
                    type="color"
                    value={color || "#3b82f6"}
                    onChange={(e) => setColor(e.target.value)}
                    className="w-20 h-10 cursor-pointer"
                  />
                  {color && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setColor("")}
                    >
                      Clear
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>

          <Button onClick={createTask} className="w-full">
            Create Task
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
