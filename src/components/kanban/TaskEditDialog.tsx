import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Trash2, Plus, Eye, FileEdit } from "lucide-react";
import { MarkdownRenderer } from "./MarkdownRenderer";
import { z } from "zod";

const descriptionSchema = z.string().max(5000, "Description must be less than 5000 characters");

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

type TaskEditDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: Task;
  onUpdate: () => void;
};

export function TaskEditDialog({ open, onOpenChange, task, onUpdate }: TaskEditDialogProps) {
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description || "");
  const [dueDate, setDueDate] = useState(task.due_date || "");
  const [newSubtaskTitle, setNewSubtaskTitle] = useState("");
  const [isPreviewMode, setIsPreviewMode] = useState(false);

  const updateTask = async () => {
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

    const { error } = await supabase
      .from("tasks")
      .update({
        title,
        description: description || null,
        due_date: dueDate || null
      })
      .eq("id", task.id);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to update task",
        variant: "destructive"
      });
    } else {
      toast({
        title: "Success",
        description: "Task updated"
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
      onOpenChange(false);
      onUpdate();
    }
  };

  const addSubtask = async () => {
    if (!newSubtaskTitle.trim()) return;

    const { data: existingSubtasks } = await supabase
      .from("subtasks")
      .select("position")
      .eq("task_id", task.id)
      .order("position", { ascending: false })
      .limit(1);

    const newPosition = existingSubtasks && existingSubtasks.length > 0 
      ? existingSubtasks[0].position + 1 
      : 0;

    const { error } = await supabase
      .from("subtasks")
      .insert({
        task_id: task.id,
        title: newSubtaskTitle,
        position: newPosition
      });

    if (error) {
      toast({
        title: "Error",
        description: "Failed to add subtask",
        variant: "destructive"
      });
    } else {
      setNewSubtaskTitle("");
      onUpdate();
    }
  };

  const toggleSubtask = async (subtaskId: string, isCompleted: boolean) => {
    const { error } = await supabase
      .from("subtasks")
      .update({ is_completed: !isCompleted })
      .eq("id", subtaskId);

    if (!error) {
      onUpdate();
    }
  };

  const deleteSubtask = async (subtaskId: string) => {
    const { error } = await supabase
      .from("subtasks")
      .delete()
      .eq("id", subtaskId);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to delete subtask",
        variant: "destructive"
      });
    } else {
      onUpdate();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Task</DialogTitle>
          <DialogDescription>Update task details and manage subtasks</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-title">Title</Label>
            <Input
              id="edit-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="edit-description">Description (Markdown supported)</Label>
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
                id="edit-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Supports **bold**, *italic*, `code`, lists, and more..."
                className="min-h-[100px] font-mono text-sm"
              />
            )}
            <p className="text-xs text-muted-foreground">
              {description.length}/5000 characters
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-due-date">Due Date</Label>
            <Input
              id="edit-due-date"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Subtasks</Label>
            <div className="space-y-2">
              {task.subtasks?.map((subtask) => (
                <div key={subtask.id} className="flex items-center gap-2 p-2 bg-secondary rounded">
                  <Checkbox
                    checked={subtask.is_completed}
                    onCheckedChange={() => toggleSubtask(subtask.id, subtask.is_completed)}
                  />
                  <span className={subtask.is_completed ? "line-through text-muted-foreground" : ""}>
                    {subtask.title}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteSubtask(subtask.id)}
                    className="ml-auto"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="New subtask"
                value={newSubtaskTitle}
                onChange={(e) => setNewSubtaskTitle(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && addSubtask()}
              />
              <Button onClick={addSubtask} size="sm">
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </div>

          <div className="flex gap-2">
            <Button onClick={updateTask} className="flex-1">
              Save Changes
            </Button>
            <Button variant="destructive" onClick={deleteTask}>
              <Trash2 className="w-4 h-4 mr-2" />
              Delete Task
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
