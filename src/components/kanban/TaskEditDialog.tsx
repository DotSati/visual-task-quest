import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Trash2, Plus, Eye, FileEdit, Paperclip, Download, X, CalendarIcon, Tag, UserPlus, User } from "lucide-react";
import { MarkdownRenderer } from "./MarkdownRenderer";
import { TaskComments } from "./TaskComments";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
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

type Attachment = {
  id: string;
  file_name: string;
  file_path: string;
  file_size: number;
  mime_type: string | null;
  created_at: string;
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
  const [dueDate, setDueDate] = useState<Date | undefined>(
    task.due_date ? new Date(task.due_date) : undefined
  );
  const [color, setColor] = useState(task.color || "");
  const [boardColors, setBoardColors] = useState<string[]>([]);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState("");
  const [editingSubtaskId, setEditingSubtaskId] = useState<string | null>(null);
  const [editingSubtaskTitle, setEditingSubtaskTitle] = useState("");
  const [subtasks, setSubtasks] = useState<Subtask[]>(task.subtasks || []);
  const [isPreviewMode, setIsPreviewMode] = useState(true);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [taskTags, setTaskTags] = useState<Tag[]>([]);
  const [availableTags, setAvailableTags] = useState<Tag[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [assignees, setAssignees] = useState<Assignee[]>([]);
  const [assigneeEmail, setAssigneeEmail] = useState("");

  useEffect(() => {
    if (open) {
      loadAttachments();
      loadBoardColors();
      loadTaskTags();
      loadAvailableTags();
      loadAssignees();
      loadSubtasks();
    }
  }, [open, task.id]);

  const loadSubtasks = async () => {
    const { data, error } = await supabase
      .from("subtasks")
      .select("*")
      .eq("task_id", task.id)
      .order("position", { ascending: true });

    if (!error && data) {
      setSubtasks(data);
    }
  };

  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (const item of Array.from(items)) {
        if (item.type.startsWith('image/')) {
          e.preventDefault();
          const file = item.getAsFile();
          if (file) {
            await uploadFile(file);
          }
        }
      }
    };

    if (open) {
      document.addEventListener('paste', handlePaste);
      return () => document.removeEventListener('paste', handlePaste);
    }
  }, [open]);

  const loadAttachments = async () => {
    const { data, error } = await supabase
      .from("task_attachments")
      .select("*")
      .eq("task_id", task.id)
      .order("created_at", { ascending: false });

    if (!error && data) {
      setAttachments(data);
    }
  };

  const loadBoardColors = async () => {
    // Get the board_id from the task's column
    const { data: column } = await supabase
      .from("columns")
      .select("board_id")
      .eq("id", task.column_id)
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

  const loadTaskTags = async () => {
    const { data, error } = await supabase
      .from("task_tags")
      .select("tag_id, tags(id, name, color)")
      .eq("task_id", task.id);

    if (!error && data) {
      const tags = data.map((tt: any) => tt.tags).filter(Boolean);
      setTaskTags(tags);
    }
  };

  const loadAvailableTags = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from("tags")
      .select("*")
      .eq("user_id", user.id)
      .order("name");

    if (!error && data) {
      setAvailableTags(data);
    }
  };

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
        due_date: dueDate ? format(dueDate, "yyyy-MM-dd") : null,
        color: color || null
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

  const addOrSelectTag = async () => {
    const trimmedTag = tagInput.trim();
    if (!trimmedTag) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Check if tag already exists for this user
    let existingTag = availableTags.find(
      (t) => t.name.toLowerCase() === trimmedTag.toLowerCase()
    );

    if (!existingTag) {
      // Create new tag
      const { data, error } = await supabase
        .from("tags")
        .insert({ user_id: user.id, name: trimmedTag })
        .select()
        .single();

      if (error) {
        toast({
          title: "Error",
          description: "Failed to create tag",
          variant: "destructive"
        });
        return;
      }
      existingTag = data;
      setAvailableTags([...availableTags, data]);
    }

    // Check if task already has this tag
    if (taskTags.some((t) => t.id === existingTag!.id)) {
      setTagInput("");
      return;
    }

    // Link tag to task
    const { error } = await supabase
      .from("task_tags")
      .insert({ task_id: task.id, tag_id: existingTag.id });

    if (error) {
      toast({
        title: "Error",
        description: "Failed to add tag to task",
        variant: "destructive"
      });
    } else {
      setTaskTags([...taskTags, existingTag]);
      setTagInput("");
    }
  };

  const removeTag = async (tagId: string) => {
    const { error } = await supabase
      .from("task_tags")
      .delete()
      .eq("task_id", task.id)
      .eq("tag_id", tagId);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to remove tag",
        variant: "destructive"
      });
    } else {
      setTaskTags(taskTags.filter((t) => t.id !== tagId));
    }
  };

  const handleTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addOrSelectTag();
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

  const addAssignee = async () => {
    const email = assigneeEmail.trim().toLowerCase();
    if (!email) return;

    // Look up user by email in profiles
    const { data: profile, error: userError } = await supabase
      .from("profiles")
      .select("id, email")
      .eq("email", email)
      .maybeSingle();

    if (userError) {
      toast({
        title: "Error",
        description: "Failed to find user",
        variant: "destructive"
      });
      return;
    }

    if (!profile) {
      toast({
        title: "User not found",
        description: "No user found with that email address",
        variant: "destructive"
      });
      return;
    }

    // Check if already assigned
    if (assignees.some((a) => a.user_id === profile.id)) {
      toast({
        title: "Already assigned",
        description: "This user is already assigned to the task"
      });
      setAssigneeEmail("");
      return;
    }

    const { data, error } = await supabase
      .from("task_assignees")
      .insert({ task_id: task.id, user_id: profile.id })
      .select("id, user_id")
      .single();

    if (error) {
      toast({
        title: "Error",
        description: "Failed to assign user",
        variant: "destructive"
      });
    } else {
      setAssignees([...assignees, { ...data, email: profile.email }]);
      setAssigneeEmail("");
      toast({
        title: "Success",
        description: `${profile.email} assigned to task`
      });
    }
  };

  const removeAssignee = async (assigneeId: string) => {
    const { error } = await supabase
      .from("task_assignees")
      .delete()
      .eq("id", assigneeId);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to remove assignee",
        variant: "destructive"
      });
    } else {
      setAssignees(assignees.filter((a) => a.id !== assigneeId));
      toast({
        title: "Success",
        description: "Assignee removed"
      });
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
      loadSubtasks();
      onUpdate();
    }
  };

  const toggleSubtask = async (subtaskId: string, isCompleted: boolean) => {
    const { error } = await supabase
      .from("subtasks")
      .update({ is_completed: !isCompleted })
      .eq("id", subtaskId);

    if (!error) {
      loadSubtasks();
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
      loadSubtasks();
      onUpdate();
    }
  };

  const startEditingSubtask = (subtask: Subtask) => {
    setEditingSubtaskId(subtask.id);
    setEditingSubtaskTitle(subtask.title);
  };

  const cancelEditingSubtask = () => {
    setEditingSubtaskId(null);
    setEditingSubtaskTitle("");
  };

  const saveSubtaskEdit = async () => {
    if (!editingSubtaskId || !editingSubtaskTitle.trim()) {
      cancelEditingSubtask();
      return;
    }

    const { error } = await supabase
      .from("subtasks")
      .update({ title: editingSubtaskTitle.trim() })
      .eq("id", editingSubtaskId);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to update subtask",
        variant: "destructive"
      });
    } else {
      loadSubtasks();
      onUpdate();
    }
    cancelEditingSubtask();
  };

  const uploadFile = async (file: File) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast({
        title: "Error",
        description: "You must be logged in to upload files",
        variant: "destructive"
      });
      return;
    }

    setIsUploading(true);
    try {
      const fileExt = file.name.split('.').pop() || 'png';
      const filePath = `${task.id}/${crypto.randomUUID()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('task-files')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { error: dbError } = await supabase
        .from('task_attachments')
        .insert({
          task_id: task.id,
          file_name: file.name,
          file_path: filePath,
          file_size: file.size,
          mime_type: file.type,
          uploaded_by: user.id
        });

      if (dbError) throw dbError;

      toast({
        title: "Success",
        description: `${file.name} uploaded`
      });
    } catch (error: any) {
      toast({
        title: "Upload Failed",
        description: `Failed to upload ${file.name}`,
        variant: "destructive"
      });
    } finally {
      setIsUploading(false);
      loadAttachments();
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    for (const file of Array.from(files)) {
      await uploadFile(file);
    }
    event.target.value = '';
  };

  const isViewableFile = (mimeType: string | null) => {
    if (!mimeType) return false;
    return mimeType.startsWith('image/') || mimeType === 'application/pdf';
  };

  const viewFile = async (attachment: Attachment) => {
    try {
      const { data, error } = await supabase.storage
        .from('task-files')
        .download(attachment.file_path);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      window.open(url, '_blank');
    } catch (error) {
      toast({
        title: "View Failed",
        description: "Failed to view file",
        variant: "destructive"
      });
    }
  };

  const downloadFile = async (attachment: Attachment) => {
    try {
      const { data, error } = await supabase.storage
        .from('task-files')
        .download(attachment.file_path);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = attachment.file_name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      toast({
        title: "Download Failed",
        description: "Failed to download file",
        variant: "destructive"
      });
    }
  };

  const deleteAttachment = async (attachment: Attachment) => {
    try {
      const { error: storageError } = await supabase.storage
        .from('task-files')
        .remove([attachment.file_path]);

      if (storageError) throw storageError;

      const { error: dbError } = await supabase
        .from('task_attachments')
        .delete()
        .eq('id', attachment.id);

      if (dbError) throw dbError;

      toast({
        title: "Success",
        description: "File deleted"
      });
      loadAttachments();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete file",
        variant: "destructive"
      });
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {task.task_number ? `Edit Task #${task.task_number}` : 'Edit Task'}
          </DialogTitle>
          <DialogDescription>Update task details and manage subtasks</DialogDescription>
        </DialogHeader>
        <div className="flex gap-2 pb-2 border-b">
          <Button onClick={updateTask} className="flex-1">
            Save Changes
          </Button>
          <Button variant="destructive" onClick={deleteTask}>
            <Trash2 className="w-4 h-4 mr-2" />
            Delete Task
          </Button>
        </div>
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
            <Label>Task Color</Label>
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
                      Clear Color
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Tags</Label>
            <div className="flex gap-2">
              <Input
                placeholder="Type tag name..."
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleTagKeyDown}
                list="available-tags"
              />
              <datalist id="available-tags">
                {availableTags.map((tag) => (
                  <option key={tag.id} value={tag.name} />
                ))}
              </datalist>
              <Button type="button" size="sm" onClick={addOrSelectTag}>
                <Tag className="h-4 w-4 mr-1" />
                Add
              </Button>
            </div>
            {taskTags.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {taskTags.map((tag) => (
                  <div
                    key={tag.id}
                    className="bg-secondary text-secondary-foreground px-2 py-1 rounded-md text-sm flex items-center gap-1"
                    style={tag.color ? { backgroundColor: tag.color, color: 'white' } : undefined}
                  >
                    {tag.name}
                    <button
                      onClick={() => removeTag(tag.id)}
                      className="hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label>Assigned People</Label>
            <div className="flex gap-2">
              <Input
                type="email"
                placeholder="Enter user email..."
                value={assigneeEmail}
                onChange={(e) => setAssigneeEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addAssignee())}
              />
              <Button type="button" size="sm" onClick={addAssignee}>
                <UserPlus className="h-4 w-4 mr-1" />
                Assign
              </Button>
            </div>
            {assignees.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {assignees.map((assignee) => (
                  <div
                    key={assignee.id}
                    className="bg-accent text-accent-foreground px-2 py-1 rounded-md text-sm flex items-center gap-1"
                  >
                    <User className="h-3 w-3" />
                    {assignee.email || `User ${assignee.user_id.slice(0, 8)}`}
                    <button
                      onClick={() => removeAssignee(assignee.id)}
                      className="hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label>Subtasks</Label>
            <div className="space-y-2">
              {subtasks.map((subtask) => (
                <div key={subtask.id} className="flex items-center gap-2 p-2 bg-secondary rounded">
                  <Checkbox
                    checked={subtask.is_completed}
                    onCheckedChange={() => toggleSubtask(subtask.id, subtask.is_completed)}
                  />
                  {editingSubtaskId === subtask.id ? (
                    <Input
                      value={editingSubtaskTitle}
                      onChange={(e) => setEditingSubtaskTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") saveSubtaskEdit();
                        if (e.key === "Escape") cancelEditingSubtask();
                      }}
                      onBlur={saveSubtaskEdit}
                      autoFocus
                      className="flex-1 h-7"
                    />
                  ) : (
                    <span
                      className={cn(
                        "flex-1 cursor-pointer hover:text-primary",
                        subtask.is_completed && "line-through text-muted-foreground"
                      )}
                      onClick={() => startEditingSubtask(subtask)}
                      title="Click to edit"
                    >
                      {subtask.title}
                    </span>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => startEditingSubtask(subtask)}
                    className={editingSubtaskId === subtask.id ? "hidden" : ""}
                    title="Edit subtask"
                  >
                    <FileEdit className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteSubtask(subtask.id)}
                    title="Delete subtask"
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

          <div className="space-y-2">
            <Label>Attachments</Label>
            <p className="text-xs text-muted-foreground">
              Drag & drop files or paste screenshots (Ctrl/Cmd+V)
            </p>
            {attachments.length > 0 && (
              <div className="space-y-2">
                {attachments.map((attachment) => (
                  <div key={attachment.id} className="flex items-center gap-2 p-2 bg-secondary rounded">
                    <Paperclip className="w-4 h-4 text-muted-foreground" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate">{attachment.file_name}</p>
                      <p className="text-xs text-muted-foreground">{formatFileSize(attachment.file_size)}</p>
                    </div>
                    {isViewableFile(attachment.mime_type) && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => viewFile(attachment)}
                        title="View file"
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => downloadFile(attachment)}
                      title="Download file"
                    >
                      <Download className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteAttachment(attachment)}
                      title="Delete file"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
            <div>
              <Input
                type="file"
                multiple
                onChange={handleFileUpload}
                disabled={isUploading}
                className="cursor-pointer"
              />
              {isUploading && <p className="text-xs text-muted-foreground mt-1">Uploading...</p>}
            </div>
          </div>

          <div className="border-t pt-4">
            <TaskComments taskId={task.id} />
          </div>

        </div>
      </DialogContent>
    </Dialog>
  );
}
