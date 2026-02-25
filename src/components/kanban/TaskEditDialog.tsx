import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Trash2, Plus, Eye, FileEdit, Paperclip, Download, X, CalendarIcon, Tag, UserPlus, User, Bell, Pin } from "lucide-react";
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
  notification_at?: string | null;
  notification_sent?: boolean;
  pinned?: boolean;
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
  const [unsavedDialogOpen, setUnsavedDialogOpen] = useState(false);
  const [notificationAt, setNotificationAt] = useState(task.notification_at || "");

  const hasUnsavedChanges = () => {
    if (title !== task.title) return true;
    if (description !== (task.description || "")) return true;
    if (color !== (task.color || "")) return true;
    if (notificationAt !== (task.notification_at || "")) return true;
    const originalDate = task.due_date ? format(new Date(task.due_date), "yyyy-MM-dd") : null;
    const currentDate = dueDate ? format(dueDate, "yyyy-MM-dd") : null;
    if (currentDate !== originalDate) return true;
    return false;
  };

  const handleClose = (openState: boolean) => {
    if (!openState && hasUnsavedChanges()) {
      setUnsavedDialogOpen(true);
      return;
    }
    onOpenChange(openState);
  };

  const handleDiscardAndClose = () => {
    setUnsavedDialogOpen(false);
    onOpenChange(false);
  };

  const handleSaveAndClose = async () => {
    await updateTask();
    setUnsavedDialogOpen(false);
    onOpenChange(false);
  };

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
        color: color || null,
        notification_at: notificationAt || null,
        notification_sent: notificationAt ? false : undefined,
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
    <>
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-0">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-background border-b px-6 py-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="text-xl font-semibold border-0 px-0 h-auto bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
                placeholder="Task title..."
              />
              <p className="text-sm text-muted-foreground mt-1">
                {task.task_number ? `Task #${task.task_number}` : 'Task'}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button
                variant={task.pinned ? "default" : "outline"}
                size="sm"
                onClick={async () => {
                  const newPinned = !task.pinned;
                  const { error } = await supabase
                    .from("tasks")
                    .update({ pinned: newPinned })
                    .eq("id", task.id);
                  if (!error) {
                    task.pinned = newPinned;
                    onUpdate();
                    toast({ title: newPinned ? "Task pinned" : "Task unpinned" });
                  }
                }}
                title={task.pinned ? "Unpin task" : "Pin to top"}
              >
                <Pin className={cn("w-4 h-4", task.pinned && "fill-current")} />
              </Button>
              <Button onClick={updateTask} size="sm">
                Save Changes
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete Task</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to delete "{task.title}"? This action cannot be undone and will also remove all subtasks, comments, and attachments.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={deleteTask} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
              <Button variant="outline" size="sm" onClick={() => handleClose(false)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-4 space-y-6">
          {/* Description Section - Full Width */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-foreground">Description</h3>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setIsPreviewMode(!isPreviewMode)}
                className="h-7 text-xs"
              >
                {isPreviewMode ? (
                  <>
                    <FileEdit className="w-3 h-3 mr-1" />
                    Edit
                  </>
                ) : (
                  <>
                    <Eye className="w-3 h-3 mr-1" />
                    Preview
                  </>
                )}
              </Button>
            </div>
            {isPreviewMode ? (
              <div className="min-h-[120px] p-4 border rounded-lg bg-muted/20" style={{ overflowWrap: 'anywhere', wordBreak: 'break-word' }}>
                {description ? (
                  <MarkdownRenderer content={description} />
                ) : (
                  <p className="text-sm text-muted-foreground italic">Click Edit to add a description...</p>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Add a detailed description... Supports **bold**, *italic*, `code`, lists, and more"
                  className="min-h-[120px] resize-none"
                />
                <p className="text-xs text-muted-foreground text-right">
                  {description.length}/5000
                </p>
              </div>
            )}
          </section>

          {/* Metadata Grid - Two Columns */}
          <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Due Date */}
            <div className="p-4 rounded-lg border bg-card space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <CalendarIcon className="w-4 h-4 text-muted-foreground" />
                Due Date
              </div>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal h-9",
                      !dueDate && "text-muted-foreground"
                    )}
                  >
                    {dueDate ? format(dueDate, "MMM d, yyyy") : "Set due date"}
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
              {dueDate && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full h-7 text-xs text-muted-foreground"
                  onClick={() => setDueDate(undefined)}
                >
                  Clear date
                </Button>
              )}
            </div>

            {/* Assignees */}
            <div className="p-4 rounded-lg border bg-card space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <User className="w-4 h-4 text-muted-foreground" />
                Assignees
              </div>
              {assignees.length > 0 && (
                <div className="space-y-2">
                  {assignees.map((assignee) => (
                    <div
                      key={assignee.id}
                      className="flex items-center gap-2 text-sm group"
                    >
                      <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <User className="w-3 h-3 text-primary" />
                      </div>
                      <span className="flex-1 truncate text-sm">
                        {assignee.email || `User ${assignee.user_id.slice(0, 8)}`}
                      </span>
                      <button
                        onClick={() => removeAssignee(assignee.id)}
                        className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <Input
                  type="email"
                  placeholder="Email..."
                  value={assigneeEmail}
                  onChange={(e) => setAssigneeEmail(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addAssignee())}
                  className="h-8 text-sm"
                />
                <Button type="button" size="sm" onClick={addAssignee} className="shrink-0 h-8">
                  <UserPlus className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            {/* Tags */}
            <div className="p-4 rounded-lg border bg-card space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Tag className="w-4 h-4 text-muted-foreground" />
                Tags
              </div>
              {taskTags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {taskTags.map((tag) => (
                    <div
                      key={tag.id}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-secondary text-secondary-foreground"
                      style={tag.color ? { backgroundColor: tag.color, color: 'white' } : undefined}
                    >
                      {tag.name}
                      <button
                        onClick={() => removeTag(tag.id)}
                        className="hover:opacity-70 transition-opacity"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <Input
                  placeholder="Add tag..."
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={handleTagKeyDown}
                  list="available-tags"
                  className="h-8 text-sm"
                />
                <datalist id="available-tags">
                  {availableTags.map((tag) => (
                    <option key={tag.id} value={tag.name} />
                  ))}
                </datalist>
                <Button type="button" size="sm" onClick={addOrSelectTag} className="shrink-0 h-8">
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            {/* Color */}
            <div className="p-4 rounded-lg border bg-card space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <div 
                  className="w-4 h-4 rounded border"
                  style={{ backgroundColor: color || 'transparent' }}
                />
                Task Color
              </div>
              {boardColors.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">Recent</p>
                  <div className="flex flex-wrap gap-2">
                    {boardColors.map((boardColor) => (
                      <button
                        key={boardColor}
                        type="button"
                        onClick={() => setColor(boardColor)}
                        className={cn(
                          "w-6 h-6 rounded-full border-2 transition-all hover:scale-110",
                          color === boardColor ? "ring-2 ring-primary ring-offset-2" : ""
                        )}
                        style={{ backgroundColor: boardColor, borderColor: 'transparent' }}
                      />
                    ))}
                  </div>
                </div>
              )}
              <div className="flex items-center gap-2">
                <Input
                  type="color"
                  value={color || "#3b82f6"}
                  onChange={(e) => setColor(e.target.value)}
                  className="w-10 h-8 p-0.5 cursor-pointer"
                />
                {color && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setColor("")}
                    className="h-8 text-xs"
                  >
                    Clear
                  </Button>
                )}
              </div>
            </div>

            {/* Notification */}
            <div className="p-4 rounded-lg border bg-card space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Bell className="w-4 h-4 text-muted-foreground" />
                Notification
              </div>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal h-9 text-sm",
                      !notificationAt && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {notificationAt ? format(new Date(notificationAt), "PPP HH:mm") : "Pick date & time"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 z-[200]" align="start">
                  <Calendar
                    mode="single"
                    selected={notificationAt ? new Date(notificationAt) : undefined}
                    onSelect={(date) => {
                      if (!date) return;
                      const existing = notificationAt ? new Date(notificationAt) : new Date();
                      date.setHours(existing.getHours(), existing.getMinutes());
                      setNotificationAt(date.toISOString());
                    }}
                    initialFocus
                    className="p-3 pointer-events-auto"
                  />
                  <div className="flex items-center gap-1 px-3 pb-3">
                    <Select
                      value={notificationAt ? String(new Date(notificationAt).getHours()) : "9"}
                      onValueChange={(h) => {
                        const d = notificationAt ? new Date(notificationAt) : new Date();
                        d.setHours(parseInt(h));
                        setNotificationAt(d.toISOString());
                      }}
                    >
                      <SelectTrigger className="w-[70px] h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="pointer-events-auto z-[201]">
                        {Array.from({ length: 24 }, (_, i) => (
                          <SelectItem key={i} value={String(i)}>{String(i).padStart(2, "0")}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <span className="text-sm text-muted-foreground">:</span>
                    <Select
                      value={notificationAt ? String(new Date(notificationAt).getMinutes()) : "0"}
                      onValueChange={(m) => {
                        const d = notificationAt ? new Date(notificationAt) : new Date();
                        d.setMinutes(parseInt(m));
                        setNotificationAt(d.toISOString());
                      }}
                    >
                      <SelectTrigger className="w-[70px] h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="pointer-events-auto z-[201]">
                        {Array.from({ length: 12 }, (_, i) => i * 5).map((m) => (
                          <SelectItem key={m} value={String(m)}>{String(m).padStart(2, "0")}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </PopoverContent>
              </Popover>
              {notificationAt && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full h-7 text-xs text-muted-foreground"
                  onClick={() => setNotificationAt("")}
                >
                  Clear notification
                </Button>
              )}
              {task.notification_sent && (
                <p className="text-xs text-muted-foreground">✓ Notification sent</p>
              )}
            </div>
          </section>

          {/* Subtasks Section - Full Width */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-foreground">
                Subtasks {subtasks.length > 0 && (
                  <span className="text-muted-foreground font-normal ml-1">
                    ({subtasks.filter(s => s.is_completed).length}/{subtasks.length})
                  </span>
                )}
              </h3>
            </div>
            <div className="space-y-2">
              {subtasks.map((subtask) => (
                <div 
                  key={subtask.id} 
                  className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent/5 transition-colors group"
                >
                  <Checkbox
                    checked={subtask.is_completed}
                    onCheckedChange={() => toggleSubtask(subtask.id, subtask.is_completed)}
                    className="shrink-0"
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
                      className="flex-1 h-8"
                    />
                  ) : (
                    <span
                      className={cn(
                        "flex-1 text-sm cursor-pointer hover:text-primary transition-colors",
                        subtask.is_completed && "line-through text-muted-foreground"
                      )}
                      onClick={() => startEditingSubtask(subtask)}
                    >
                      {subtask.title}
                    </span>
                  )}
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => startEditingSubtask(subtask)}
                    >
                      <FileEdit className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => deleteSubtask(subtask.id)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
              <div className="flex gap-2">
                <Input
                  placeholder="Add a subtask..."
                  value={newSubtaskTitle}
                  onChange={(e) => setNewSubtaskTitle(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && addSubtask()}
                  className="h-9"
                />
                <Button onClick={addSubtask} size="sm" className="shrink-0">
                  <Plus className="w-4 h-4 mr-1" />
                  Add
                </Button>
              </div>
            </div>
          </section>

          {/* Attachments Section - Full Width */}
          <section className="space-y-3">
            <h3 className="text-sm font-medium text-foreground">Attachments</h3>
            {attachments.length > 0 && (
              <div className="grid gap-2">
                {attachments.map((attachment) => (
                  <div 
                    key={attachment.id} 
                    className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent/5 transition-colors group"
                  >
                    <div className="w-8 h-8 rounded bg-muted flex items-center justify-center shrink-0">
                      <Paperclip className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{attachment.file_name}</p>
                      <p className="text-xs text-muted-foreground">{formatFileSize(attachment.file_size)}</p>
                    </div>
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                      {isViewableFile(attachment.mime_type) && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => viewFile(attachment)}
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => downloadFile(attachment)}
                      >
                        <Download className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => deleteAttachment(attachment)}
                      >
                        <X className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="relative border-2 border-dashed rounded-lg p-4 text-center hover:border-primary/50 transition-colors cursor-pointer">
              <Input
                type="file"
                multiple
                onChange={handleFileUpload}
                disabled={isUploading}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                id="file-upload"
              />
              <Paperclip className="w-6 h-6 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">
                {isUploading ? "Uploading..." : "Drop files or click to upload"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Paste screenshots with Ctrl/Cmd+V
              </p>
            </div>
          </section>

          {/* Comments Section - Full Width */}
          <section className="space-y-3 pt-4 border-t">
            <h3 className="text-sm font-medium text-foreground">Comments</h3>
            <TaskComments taskId={task.id} />
          </section>
        </div>
      </DialogContent>
    </Dialog>

    <AlertDialog open={unsavedDialogOpen} onOpenChange={setUnsavedDialogOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Unsaved Changes</AlertDialogTitle>
          <AlertDialogDescription>
            You have unsaved changes. Would you like to save them before closing?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleDiscardAndClose}>Discard</AlertDialogCancel>
          <AlertDialogAction onClick={handleSaveAndClose}>Save Changes</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}
