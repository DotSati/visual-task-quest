import { useDroppable } from "@dnd-kit/core";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/button";
import { Plus, MoreVertical, Trash2, ArrowUpDown, Edit, Copy, EyeOff, Eye, Download, Upload, GripVertical } from "lucide-react";
import { TaskCard } from "./TaskCard";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useState, useMemo, useEffect } from "react";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

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
  created_at?: string;
  hidden?: boolean;
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
  isHighlighted?: boolean;
}

export function KanbanColumn({ 
  column, 
  tasks, 
  onAddTask, 
  onTaskUpdate, 
  onColumnDelete,
  onColumnUpdate,
  onTaskClick,
  isHighlighted = false
}: KanbanColumnProps) {
  const { setNodeRef: setDroppableRef, isOver } = useDroppable({
    id: column.id,
  });

  const {
    attributes,
    listeners,
    setNodeRef: setSortableRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: column.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const setNodeRef = (node: HTMLElement | null) => {
    setDroppableRef(node);
    setSortableRef(node);
  };

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editedTitle, setEditedTitle] = useState(column.title);
  const [showHidden, setShowHidden] = useState(false);
  const [allTasks, setAllTasks] = useState<Task[]>([]);
  const [hiddenCount, setHiddenCount] = useState(0);
  const fileInputRef = useState<HTMLInputElement | null>(null)[0];

  // Load all tasks including hidden ones to get the count
  const loadHiddenTasksCount = async () => {
    const { data, error } = await supabase
      .from("tasks")
      .select("*")
      .eq("column_id", column.id)
      .eq("hidden", true);

    if (!error && data) {
      setHiddenCount(data.length);
    }
  };

  // Load all tasks when showing hidden
  const loadAllTasks = async () => {
    const { data, error } = await supabase
      .from("tasks")
      .select("*")
      .eq("column_id", column.id)
      .order("position");

    if (!error && data) {
      setAllTasks(data);
    }
  };

  // Update when tasks or column changes
  useEffect(() => {
    loadHiddenTasksCount();
    if (showHidden) {
      loadAllTasks();
    }
  }, [column.id, tasks, showHidden]);

  const displayTasks = showHidden ? allTasks : tasks;

  const unhideTask = async (taskId: string) => {
    const { error } = await supabase
      .from("tasks")
      .update({ hidden: false })
      .eq("id", taskId);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to unhide task",
        variant: "destructive"
      });
    } else {
      toast({
        title: "Success",
        description: "Task unhidden"
      });
      onTaskUpdate();
      loadHiddenTasksCount();
      if (showHidden) {
        loadAllTasks();
      }
    }
  };

  const sortedTasks = useMemo(() => {
    const sortOrder = column.sort_order || 'task_number_desc';
    const tasksToSort = displayTasks;
    
    if (sortOrder === 'manual') {
      return [...tasksToSort].sort((a, b) => a.position - b.position);
    }
    
    if (sortOrder === 'due_date_priority') {
      return [...tasksToSort].sort((a, b) => {
        const aHasDate = !!a.due_date;
        const bHasDate = !!b.due_date;
        
        // Tasks with due dates come first
        if (aHasDate && !bHasDate) return -1;
        if (!aHasDate && bHasDate) return 1;
        
        // Both have due dates - sort by date, then by task number
        if (aHasDate && bHasDate) {
          const dateCompare = new Date(a.due_date!).getTime() - new Date(b.due_date!).getTime();
          if (dateCompare !== 0) return dateCompare;
          return (a.task_number ?? 0) - (b.task_number ?? 0);
        }
        
      // Neither has due date - sort by task number
        return (a.task_number ?? 0) - (b.task_number ?? 0);
      });
    }
    
    return [...tasksToSort].sort((a, b) => {
      const aNum = a.task_number ?? 0;
      const bNum = b.task_number ?? 0;
      
      if (sortOrder === 'task_number_desc') {
        return bNum - aNum;
      } else {
        return aNum - bNum;
      }
    });
  }, [displayTasks, column.sort_order]);

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

  const updateColumnTitle = async () => {
    if (!editedTitle.trim()) {
      toast({
        title: "Error",
        description: "Column title cannot be empty",
        variant: "destructive"
      });
      return;
    }

    const { error } = await supabase
      .from("columns")
      .update({ title: editedTitle })
      .eq("id", column.id);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to update column",
        variant: "destructive"
      });
    } else {
      toast({
        title: "Success",
        description: "Column updated"
      });
      onColumnUpdate();
      setEditDialogOpen(false);
    }
  };

  const copyColumnId = () => {
    navigator.clipboard.writeText(column.id);
    toast({
      title: "Copied",
      description: "Column ID copied to clipboard"
    });
  };

  const hideAllTasks = async () => {
    if (tasks.length === 0) {
      toast({
        title: "No tasks",
        description: "There are no tasks to hide",
        variant: "destructive"
      });
      return;
    }

    const { error } = await supabase
      .from("tasks")
      .update({ hidden: true })
      .in("id", tasks.map(t => t.id));

    if (error) {
      toast({
        title: "Error",
        description: "Failed to hide tasks",
        variant: "destructive"
      });
    } else {
      toast({
        title: "Success",
        description: `Hidden ${tasks.length} task${tasks.length === 1 ? '' : 's'}`
      });
      onTaskUpdate();
      loadHiddenTasksCount();
    }
  };

  const toggleShowHidden = () => {
    if (!showHidden) {
      loadAllTasks();
    }
    setShowHidden(!showHidden);
  };

  const exportToCSV = () => {
    if (displayTasks.length === 0) {
      toast({
        title: "No tasks",
        description: "There are no tasks to export",
        variant: "destructive"
      });
      return;
    }

    // Create CSV header
    const header = "Due Date,Name,Description\n";
    
    // Create CSV rows
    const rows = displayTasks.map(task => {
      const dueDate = task.due_date || "";
      const name = task.title.replace(/"/g, '""'); // Escape quotes
      const description = (task.description || "").replace(/"/g, '""').replace(/\n/g, " "); // Escape quotes and remove newlines
      
      return `"${dueDate}","${name}","${description}"`;
    }).join("\n");

    // Combine header and rows
    const csv = header + rows;

    // Create blob and download
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `${column.title}_tasks.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: "Success",
      description: `Exported ${displayTasks.length} task${displayTasks.length === 1 ? '' : 's'} to CSV`
    });
  };

  const importFromCSV = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const lines = text.split('\n').filter(line => line.trim());
      
      if (lines.length < 2) {
        toast({
          title: "Error",
          description: "CSV file is empty or invalid",
          variant: "destructive"
        });
        return;
      }

      // Parse header to find Name and Description columns
      const header = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
      const nameIndex = header.findIndex(h => h.toLowerCase() === 'name');
      const descriptionIndex = header.findIndex(h => h.toLowerCase() === 'description');

      if (nameIndex === -1) {
        toast({
          title: "Error",
          description: "CSV must have a 'Name' column",
          variant: "destructive"
        });
        return;
      }

      // Get the highest position in the column
      const { data: existingTasks } = await supabase
        .from("tasks")
        .select("position")
        .eq("column_id", column.id)
        .order("position", { ascending: false })
        .limit(1);

      let nextPosition = existingTasks && existingTasks.length > 0 ? existingTasks[0].position + 1 : 0;

      // Parse and create tasks
      const tasksToCreate = [];
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        if (!line.trim()) continue;

        // Simple CSV parsing (handles quoted fields)
        const values: string[] = [];
        let currentValue = '';
        let insideQuotes = false;

        for (let j = 0; j < line.length; j++) {
          const char = line[j];
          if (char === '"') {
            insideQuotes = !insideQuotes;
          } else if (char === ',' && !insideQuotes) {
            values.push(currentValue.trim().replace(/^"|"$/g, ''));
            currentValue = '';
          } else {
            currentValue += char;
          }
        }
        values.push(currentValue.trim().replace(/^"|"$/g, ''));

        const name = values[nameIndex]?.trim();
        if (!name) continue;

        const description = descriptionIndex !== -1 ? values[descriptionIndex]?.trim() || null : null;

        tasksToCreate.push({
          column_id: column.id,
          title: name,
          description: description,
          position: nextPosition++
        });
      }

      if (tasksToCreate.length === 0) {
        toast({
          title: "No tasks",
          description: "No valid tasks found in CSV",
          variant: "destructive"
        });
        return;
      }

      // Insert tasks
      const { error } = await supabase
        .from("tasks")
        .insert(tasksToCreate);

      if (error) {
        toast({
          title: "Error",
          description: "Failed to import tasks",
          variant: "destructive"
        });
      } else {
        toast({
          title: "Success",
          description: `Imported ${tasksToCreate.length} task${tasksToCreate.length === 1 ? '' : 's'}`
        });
        onTaskUpdate();
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to parse CSV file",
        variant: "destructive"
      });
    }

    // Reset file input
    event.target.value = '';
  };

  const triggerFileInput = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv';
    input.onchange = importFromCSV as any;
    input.click();
  };

  return (
    <>
      <div 
        ref={setNodeRef}
        style={style}
        className={cn(
          "flex flex-col bg-card rounded-lg p-3 border transition-all duration-200",
          (isOver || isHighlighted) && "bg-primary/10 ring-2 ring-primary shadow-xl scale-[1.03] border-primary",
          isDragging && "opacity-50 ring-2 ring-primary"
        )}
      >
        <div className="flex items-center justify-between mb-3 group">
          <div className="flex items-center gap-2">
            <div
              {...attributes}
              {...listeners}
              className="cursor-grab active:cursor-grabbing p-1 -m-1 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <GripVertical className="w-4 h-4 text-muted-foreground" />
            </div>
            <h3 className="font-semibold text-foreground">{column.title}</h3>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setEditDialogOpen(true)}>
                <Edit className="mr-2 h-4 w-4" />
                Edit Column
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {hiddenCount > 0 && (
                <>
                  <DropdownMenuItem onClick={toggleShowHidden}>
                    {showHidden ? (
                      <>
                        <EyeOff className="mr-2 h-4 w-4" />
                        Hide Hidden Tasks
                      </>
                    ) : (
                      <>
                        <Eye className="mr-2 h-4 w-4" />
                        Show Hidden Tasks
                      </>
                    )}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              )}
              <DropdownMenuItem onClick={() => updateSortOrder('task_number_desc')}>
                <ArrowUpDown className="mr-2 h-4 w-4" />
                Task # (Descending) {column.sort_order === 'task_number_desc' && '✓'}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => updateSortOrder('task_number_asc')}>
                <ArrowUpDown className="mr-2 h-4 w-4" />
                Task # (Ascending) {column.sort_order === 'task_number_asc' && '✓'}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => updateSortOrder('due_date_priority')}>
                <ArrowUpDown className="mr-2 h-4 w-4" />
                Due Date Priority {column.sort_order === 'due_date_priority' && '✓'}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => updateSortOrder('manual')}>
                <ArrowUpDown className="mr-2 h-4 w-4" />
                Manual Order {column.sort_order === 'manual' && '✓'}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={hideAllTasks}>
                <EyeOff className="mr-2 h-4 w-4" />
                Hide All Tasks
              </DropdownMenuItem>
              <DropdownMenuItem onClick={exportToCSV}>
                <Download className="mr-2 h-4 w-4" />
                Export to CSV
              </DropdownMenuItem>
              <DropdownMenuItem onClick={triggerFileInput}>
                <Upload className="mr-2 h-4 w-4" />
                Import from CSV
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

        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-muted-foreground hover:text-foreground mb-2"
          onClick={onAddTask}
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Task
        </Button>

        <div className="space-y-2">
          {sortedTasks.map((task) => (
            <div key={task.id} className="relative">
              <TaskCard 
                task={task} 
                onUpdate={() => {
                  onTaskUpdate();
                  loadHiddenTasksCount();
                  if (showHidden) loadAllTasks();
                }} 
                onClick={() => onTaskClick(task.id)} 
                className={task.hidden ? "opacity-50" : ""}
              />
              {task.hidden && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute top-2 right-2 h-7 px-2 bg-background/90 hover:bg-background"
                  onClick={(e) => {
                    e.stopPropagation();
                    unhideTask(task.id);
                  }}
                >
                  <Eye className="h-3 w-3 mr-1" />
                  Unhide
                </Button>
              )}
            </div>
          ))}
        </div>
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

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Column</DialogTitle>
            <DialogDescription>
              Update the column name and view its ID
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="column-title">Column Name</Label>
              <Input
                id="column-title"
                value={editedTitle}
                onChange={(e) => setEditedTitle(e.target.value)}
                placeholder="Enter column name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="column-id">Column ID</Label>
              <div className="flex gap-2">
                <Input
                  id="column-id"
                  value={column.id}
                  readOnly
                  className="font-mono text-sm"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={copyColumnId}
                  type="button"
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={updateColumnTitle}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
