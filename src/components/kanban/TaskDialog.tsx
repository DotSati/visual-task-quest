import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DropdownMenu, DropdownMenuContent, DropdownMenuCheckboxItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { CalendarIcon, Eye, FileEdit, Tag, Paperclip, X } from "lucide-react";
import { MarkdownRenderer } from "./MarkdownRenderer";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { z } from "zod";

const descriptionSchema = z.string().max(5000, "Description must be less than 5000 characters");

type TagType = {
  id: string;
  name: string;
  color: string | null;
};

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
  
  // New state for tags and attachments
  const [allTags, setAllTags] = useState<TagType[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [savedTaskId, setSavedTaskId] = useState<string | null>(null);
  const [pendingAttachments, setPendingAttachments] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open && columnId) {
      loadBoardColors();
      loadAllTags();
    }
    if (!open) {
      // Reset state when dialog closes
      setSavedTaskId(null);
      setSelectedTagIds([]);
      setPendingAttachments([]);
    }
  }, [open, columnId]);

  const loadAllTags = async () => {
    const { data } = await supabase
      .from("tags")
      .select("*")
      .order("name");
    if (data) setAllTags(data);
  };

  const loadBoardColors = async () => {
    if (!columnId) return;

    const { data: column } = await supabase
      .from("columns")
      .select("board_id")
      .eq("id", columnId)
      .single();

    if (column) {
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

  const saveTaskIfNeeded = async (): Promise<string | null> => {
    if (savedTaskId) return savedTaskId;

    if (!title.trim() || !columnId) {
      toast({
        title: "Error",
        description: "Task title is required before adding tags or attachments",
        variant: "destructive"
      });
      return null;
    }

    const validation = descriptionSchema.safeParse(description);
    if (!validation.success) {
      toast({
        title: "Validation Error",
        description: validation.error.errors[0].message,
        variant: "destructive"
      });
      return null;
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

    const { data, error } = await supabase
      .from("tasks")
      .insert({
        column_id: columnId,
        title,
        description: description || null,
        due_date: dueDate ? format(dueDate, "yyyy-MM-dd") : null,
        color: color || null,
        position: newPosition
      })
      .select()
      .single();

    if (error || !data) {
      toast({
        title: "Error",
        description: "Failed to create task",
        variant: "destructive"
      });
      return null;
    }

    setSavedTaskId(data.id);
    toast({
      title: "Task saved",
      description: "You can now add tags and attachments"
    });
    onTaskCreated();
    return data.id;
  };

  const toggleTag = async (tagId: string) => {
    const taskId = await saveTaskIfNeeded();
    if (!taskId) return;

    const isSelected = selectedTagIds.includes(tagId);

    if (isSelected) {
      const { error } = await supabase
        .from("task_tags")
        .delete()
        .eq("task_id", taskId)
        .eq("tag_id", tagId);

      if (!error) {
        setSelectedTagIds(prev => prev.filter(id => id !== tagId));
      }
    } else {
      const { error } = await supabase
        .from("task_tags")
        .insert({ task_id: taskId, tag_id: tagId });

      if (!error) {
        setSelectedTagIds(prev => [...prev, tagId]);
      }
    }
    onTaskCreated();
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const taskId = await saveTaskIfNeeded();
    if (!taskId) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    for (const file of Array.from(files)) {
      const filePath = `${user.id}/${taskId}/${Date.now()}_${file.name}`;
      
      const { error: uploadError } = await supabase.storage
        .from("task-attachments")
        .upload(filePath, file);

      if (uploadError) {
        toast({
          title: "Upload failed",
          description: `Failed to upload ${file.name}`,
          variant: "destructive"
        });
        continue;
      }

      const { error: dbError } = await supabase
        .from("task_attachments")
        .insert({
          task_id: taskId,
          file_name: file.name,
          file_path: filePath,
          file_size: file.size,
          mime_type: file.type,
          uploaded_by: user.id
        });

      if (dbError) {
        toast({
          title: "Error",
          description: `Failed to save attachment record for ${file.name}`,
          variant: "destructive"
        });
      } else {
        setPendingAttachments(prev => [...prev, file]);
        toast({
          title: "Attachment added",
          description: file.name
        });
      }
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    onTaskCreated();
  };

  const createTask = async () => {
    if (savedTaskId) {
      // Task already saved, just close
      resetAndClose();
      return;
    }

    if (!title.trim() || !columnId) {
      toast({
        title: "Error",
        description: "Task title is required",
        variant: "destructive"
      });
      return;
    }

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
      resetAndClose();
      onTaskCreated();
    }
  };

  const resetAndClose = () => {
    setTitle("");
    setDescription("");
    setDueDate(undefined);
    setColor("");
    setIsPreviewMode(false);
    setSavedTaskId(null);
    setSelectedTagIds([]);
    setPendingAttachments([]);
    onOpenChange(false);
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
              disabled={!!savedTaskId}
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
                disabled={!!savedTaskId}
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
                  disabled={!!savedTaskId}
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
                        disabled={!!savedTaskId}
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
                    disabled={!!savedTaskId}
                  />
                  {color && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setColor("")}
                      disabled={!!savedTaskId}
                    >
                      Clear
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Tags and Attachments buttons */}
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5">
                  <Tag className="w-4 h-4" />
                  Tags
                  {selectedTagIds.length > 0 && (
                    <span className="ml-1 px-1.5 py-0.5 text-xs rounded-full bg-primary text-primary-foreground">
                      {selectedTagIds.length}
                    </span>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-48">
                {allTags.length === 0 ? (
                  <div className="px-2 py-1.5 text-sm text-muted-foreground">
                    No tags available
                  </div>
                ) : (
                  allTags.map((tag) => (
                    <DropdownMenuCheckboxItem
                      key={tag.id}
                      checked={selectedTagIds.includes(tag.id)}
                      onCheckedChange={() => toggleTag(tag.id)}
                    >
                      <div className="flex items-center gap-2">
                        {tag.color && (
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: tag.color }}
                          />
                        )}
                        {tag.name}
                      </div>
                    </DropdownMenuCheckboxItem>
                  ))
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => fileInputRef.current?.click()}
            >
              <Paperclip className="w-4 h-4" />
              Attachments
              {pendingAttachments.length > 0 && (
                <span className="ml-1 px-1.5 py-0.5 text-xs rounded-full bg-primary text-primary-foreground">
                  {pendingAttachments.length}
                </span>
              )}
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={handleFileSelect}
            />
          </div>

          {/* Show selected tags */}
          {selectedTagIds.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {selectedTagIds.map((tagId) => {
                const tag = allTags.find(t => t.id === tagId);
                if (!tag) return null;
                return (
                  <span
                    key={tag.id}
                    className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full"
                    style={{
                      backgroundColor: tag.color ? `${tag.color}20` : 'hsl(var(--muted))',
                      color: tag.color || 'hsl(var(--muted-foreground))'
                    }}
                  >
                    {tag.name}
                    <button
                      type="button"
                      onClick={() => toggleTag(tag.id)}
                      className="hover:opacity-70"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                );
              })}
            </div>
          )}

          {/* Show pending attachments */}
          {pendingAttachments.length > 0 && (
            <div className="space-y-1">
              {pendingAttachments.map((file, idx) => (
                <div key={idx} className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Paperclip className="w-3 h-3" />
                  {file.name}
                </div>
              ))}
            </div>
          )}

          <Button onClick={createTask} className="w-full">
            {savedTaskId ? "Done" : "Create Task"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
