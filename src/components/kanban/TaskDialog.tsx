import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Eye, FileEdit } from "lucide-react";
import { MarkdownRenderer } from "./MarkdownRenderer";
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
  const [dueDate, setDueDate] = useState("");
  const [isPreviewMode, setIsPreviewMode] = useState(false);

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
        due_date: dueDate || null,
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
      setDueDate("");
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
            <Label htmlFor="task-due-date">Due Date</Label>
            <Input
              id="task-due-date"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>
          <Button onClick={createTask} className="w-full">
            Create Task
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
