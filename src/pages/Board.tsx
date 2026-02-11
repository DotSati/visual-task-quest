import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { ArrowLeft, ChevronDown, Search, Settings, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { DndContext, DragEndEvent, DragOverEvent, DragStartEvent, DragOverlay, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, arrayMove, horizontalListSortingStrategy } from "@dnd-kit/sortable";
import { KanbanColumn } from "@/components/kanban/KanbanColumn";
import { TaskCard } from "@/components/kanban/TaskCard";
import { TaskDialog } from "@/components/kanban/TaskDialog";
import { TaskEditDialog } from "@/components/kanban/TaskEditDialog";
import { ColumnDialog } from "@/components/kanban/ColumnDialog";
import { BoardSettingsDialog } from "@/components/kanban/BoardSettingsDialog";
import { TagFilter } from "@/components/kanban/TagFilter";
import { DateChangeDialog } from "@/components/kanban/DateChangeDialog";
import { useAutomation } from "@/hooks/useAutomation";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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

export default function Board() {
  const { boardId } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [board, setBoard] = useState<any>(null);
  const [boards, setBoards] = useState<any[]>([]);
  const [columns, setColumns] = useState<Column[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [columnDialogOpen, setColumnDialogOpen] = useState(false);
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
  const [selectedColumnId, setSelectedColumnId] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [taskEditOpen, setTaskEditOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [highlightedColumnId, setHighlightedColumnId] = useState<string | null>(null);
  const [dropTargetTaskId, setDropTargetTaskId] = useState<string | null>(null);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [taskTags, setTaskTags] = useState<Record<string, string[]>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [pendingMove, setPendingMove] = useState<{
    taskId: string;
    targetColumnId: string;
    targetPosition: number;
  } | null>(null);
  const [dateChangeDialogOpen, setDateChangeDialogOpen] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  useEffect(() => {
    loadBoard();
    loadBoards();
    loadColumns();
    loadTasks();
    loadTaskTags();
  }, [boardId]);

  // Real-time subscription for tasks - listens to all task changes and reloads
  useEffect(() => {
    if (!boardId || columns.length === 0) return;

    // Get column IDs for this board to filter relevant task changes
    const columnIds = columns.map(c => c.id);

    const channel = supabase
      .channel(`tasks-board-${boardId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tasks'
        },
        (payload) => {
          // Check if the task belongs to one of our columns
          const newRecord = payload.new as { column_id?: string } | null;
          const oldRecord = payload.old as { column_id?: string } | null;
          
          const isRelevant = 
            (newRecord?.column_id && columnIds.includes(newRecord.column_id)) ||
            (oldRecord?.column_id && columnIds.includes(oldRecord.column_id));

          if (isRelevant) {
            loadTasks();
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          // When subscription is established, ensure we have latest data
          loadTasks();
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [boardId, columns]);

  // Real-time subscription for columns
  useEffect(() => {
    if (!boardId) return;

    const channel = supabase
      .channel(`columns-${boardId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'columns',
          filter: `board_id=eq.${boardId}`
        },
        () => {
          loadColumns();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [boardId]);


  useEffect(() => {
    const taskId = searchParams.get('task');
    if (taskId && tasks.length > 0) {
      setSelectedTaskId(taskId);
      setTaskEditOpen(true);
    }
  }, [searchParams, tasks]);

  const loadBoard = async () => {
    const { data, error } = await supabase
      .from("boards")
      .select("*")
      .eq("id", boardId)
      .single();

    if (error || !data) {
      toast({
        title: "Error",
        description: "Board not found",
        variant: "destructive"
      });
      navigate("/dashboard");
    } else {
      setBoard(data);
    }
  };

  const loadBoards = async () => {
    const { data: session } = await supabase.auth.getSession();
    if (!session.session?.user) return;

    const { data, error } = await supabase
      .from("boards")
      .select("*")
      .eq("user_id", session.session.user.id)
      .order("position", { ascending: true });

    if (!error && data) {
      setBoards(data);
    }
  };

  const loadColumns = async () => {
    const { data, error } = await supabase
      .from("columns")
      .select("*")
      .eq("board_id", boardId)
      .order("position");

    if (error) {
      toast({
        title: "Error",
        description: "Failed to load columns",
        variant: "destructive"
      });
    } else {
      setColumns(data || []);
    }
  };

  const loadTasks = async () => {
    const { data: tasksData, error: tasksError } = await supabase
      .from("tasks")
      .select(`
        *,
        columns!inner(board_id)
      `)
      .eq("columns.board_id", boardId)
      .eq("hidden", false)
      .order("position");

    if (tasksError) {
      toast({
        title: "Error",
        description: "Failed to load tasks",
        variant: "destructive"
      });
      return;
    }

    const { data: subtasksData } = await supabase
      .from("subtasks")
      .select("*")
      .in("task_id", (tasksData || []).map(t => t.id))
      .order("position");

    const tasksWithSubtasks = (tasksData || []).map(task => ({
      ...task,
      subtasks: (subtasksData || []).filter(st => st.task_id === task.id)
    }));

    setTasks(tasksWithSubtasks);
  };

  const loadTaskTags = async () => {
    // Get all tasks for this board and their tags
    const { data: tasksData } = await supabase
      .from("tasks")
      .select(`
        id,
        columns!inner(board_id)
      `)
      .eq("columns.board_id", boardId);

    if (!tasksData || tasksData.length === 0) {
      setTaskTags({});
      return;
    }

    const taskIds = tasksData.map(t => t.id);
    const { data: tagData } = await supabase
      .from("task_tags")
      .select("task_id, tag_id")
      .in("task_id", taskIds);

    if (tagData) {
      const tagsMap: Record<string, string[]> = {};
      tagData.forEach(tt => {
        if (!tagsMap[tt.task_id]) {
          tagsMap[tt.task_id] = [];
        }
        tagsMap[tt.task_id].push(tt.tag_id);
      });
      setTaskTags(tagsMap);
    }
  };

  const { loadRules, rules: automationRules } = useAutomation(boardId, tasks, loadTasks);

  const moveTask = async (taskId: string, targetColumnId: string, targetPosition: number, newDueDate?: string) => {
    const updateData: Record<string, any> = {
      column_id: targetColumnId,
      position: targetPosition,
    };
    if (newDueDate) {
      updateData.due_date = newDueDate;
    }

    const { error } = await supabase
      .from("tasks")
      .update(updateData)
      .eq("id", taskId);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to move task",
        variant: "destructive",
      });
    }
    loadTasks();
  };

  const handleDateChangeConfirm = async (newDate: Date) => {
    if (!pendingMove) return;
    const dateStr = newDate.toISOString().split("T")[0];
    await moveTask(pendingMove.taskId, pendingMove.targetColumnId, pendingMove.targetPosition, dateStr);
    setDateChangeDialogOpen(false);
    setPendingMove(null);
  };

  const handleDateChangeCancel = () => {
    setDateChangeDialogOpen(false);
    setPendingMove(null);
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) {
      setHighlightedColumnId(null);
      setDropTargetTaskId(null);
      return;
    }

    const activeId = active.id as string;
    const overId = over.id as string;

    const activeTask = tasks.find(t => t.id === activeId);
    const overTask = tasks.find(t => t.id === overId);
    const overColumn = columns.find(c => c.id === overId);

    if (!activeTask) return;

    // Update highlighted column and drop target
    if (overTask) {
      setHighlightedColumnId(overTask.column_id);
      setDropTargetTaskId(overTask.id);
    } else if (overColumn) {
      setHighlightedColumnId(overColumn.id);
      setDropTargetTaskId(null);
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    setHighlightedColumnId(null);
    setDropTargetTaskId(null);

    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;
    
    // Check if we're dragging a column
    const activeColumn = columns.find(c => c.id === activeId);
    const overColumn = columns.find(c => c.id === overId);
    
    if (activeColumn && overColumn && activeId !== overId) {
      // Column reordering
      const oldIndex = columns.findIndex(c => c.id === activeId);
      const newIndex = columns.findIndex(c => c.id === overId);
      
      const newColumns = arrayMove(columns, oldIndex, newIndex);
      setColumns(newColumns);
      
      // Update positions in database
      for (let i = 0; i < newColumns.length; i++) {
        await supabase
          .from("columns")
          .update({ position: i })
          .eq("id", newColumns[i].id);
      }
      return;
    }
    
    // Task dragging
    const activeTask = tasks.find(t => t.id === activeId);
    if (!activeTask) return;

    // Determine target column
    const overTask = tasks.find(t => t.id === overId);
    const targetColumn = columns.find(c => c.id === overId);
    
    let targetColumnId = activeTask.column_id;
    let targetPosition = activeTask.position;
    
    if (overTask) {
      // Dropped on another task
      targetColumnId = overTask.column_id;
      targetPosition = overTask.position;
    } else if (targetColumn) {
      // Dropped on an empty column
      targetColumnId = targetColumn.id;
      const tasksInColumn = tasks.filter(t => t.column_id === targetColumn.id);
      targetPosition = tasksInColumn.length;
    }

    // Check if task is overdue, moving to a different column, and target column has automation rules
    const targetHasRules = automationRules.some(r => r.source_column_id === targetColumnId);
    if (activeTask.due_date && targetColumnId !== activeTask.column_id && targetHasRules) {
      const today = new Date().toISOString().split("T")[0];
      if (activeTask.due_date < today) {
        setPendingMove({ taskId: activeId, targetColumnId, targetPosition });
        setDateChangeDialogOpen(true);
        return;
      }
    }

    await moveTask(activeId, targetColumnId, targetPosition);
  };

  const openNewTaskDialog = (columnId: string) => {
    setSelectedColumnId(columnId);
    setTaskDialogOpen(true);
  };

  const handleTaskEditClose = () => {
    setTaskEditOpen(false);
    setSelectedTaskId(null);
    setSearchParams({});
    loadTasks();
    setRefreshKey(prev => prev + 1);
  };


  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-[calc(100vw-2rem)] mx-auto">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")}>
              <ArrowLeft className="w-4 h-4 mr-1.5" />
              Back
            </Button>
            <h1 className="text-2xl font-bold gradient-text">
              {board?.title}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search tasks..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-48 h-9 pl-8 pr-8 text-sm"
              />
              {searchQuery && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 p-0"
                  onClick={() => setSearchQuery("")}
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
            </div>
            <TagFilter
              boardId={boardId!}
              selectedTagIds={selectedTagIds}
              onFilterChange={setSelectedTagIds}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSettingsDialogOpen(true)}
            >
              <Settings className="w-4 h-4 mr-1.5" />
              Settings
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  Switch Board
                  <ChevronDown className="w-4 h-4 ml-1.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                {boards.map((b) => (
                  <DropdownMenuItem
                    key={b.id}
                    onClick={() => navigate(`/board/${b.id}`)}
                    className={b.id === boardId ? "bg-accent" : ""}
                  >
                    {b.title}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <Button size="sm" onClick={() => setColumnDialogOpen(true)}>
              Add Column
            </Button>
          </div>
        </div>

        <DndContext
          sensors={sensors}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={columns.map(c => c.id)} strategy={horizontalListSortingStrategy}>
            <div 
              className="grid gap-3 overflow-x-auto pb-4"
              style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))` }}
            >
              {columns.map((column) => {
                // Filter tasks by search query and selected tags
                const columnTasks = tasks.filter(t => t.column_id === column.id);
                const searchFilteredTasks = searchQuery.trim() === ""
                  ? columnTasks
                  : columnTasks.filter(task => {
                      const query = searchQuery.toLowerCase();
                      return (
                        task.title.toLowerCase().includes(query) ||
                        (task.description && task.description.toLowerCase().includes(query))
                      );
                    });
                const filteredTasks = selectedTagIds.length === 0
                  ? searchFilteredTasks
                  : searchFilteredTasks.filter(task => {
                      const tagIds = taskTags[task.id] || [];
                      return selectedTagIds.some(tagId => tagIds.includes(tagId));
                    });

                return (
                <KanbanColumn
                  key={column.id}
                  column={column}
                  tasks={filteredTasks}
                  onAddTask={() => openNewTaskDialog(column.id)}
                  onTaskUpdate={loadTasks}
                  onColumnDelete={loadColumns}
                  onColumnUpdate={loadColumns}
                  onTaskClick={(taskId) => {
                    setSearchParams({ task: taskId });
                  }}
                  isHighlighted={highlightedColumnId === column.id}
                  refreshKey={refreshKey}
                  activeId={activeId}
                  dropTargetTaskId={dropTargetTaskId}
                />
              );
              })}
            </div>
          </SortableContext>
          <DragOverlay
            dropAnimation={{
              duration: 250,
              easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)',
            }}
          >
            {activeId && tasks.find(t => t.id === activeId) ? (
              <TaskCard
                task={tasks.find(t => t.id === activeId)!}
                onUpdate={() => {}}
                className="rotate-3 shadow-2xl opacity-90"
              />
            ) : null}
          </DragOverlay>
        </DndContext>

        {selectedTaskId && (
          <TaskEditDialog
            open={taskEditOpen}
            onOpenChange={handleTaskEditClose}
            task={tasks.find(t => t.id === selectedTaskId)!}
            onUpdate={loadTasks}
          />
        )}

        <TaskDialog
          open={taskDialogOpen}
          onOpenChange={setTaskDialogOpen}
          columnId={selectedColumnId}
          onTaskCreated={loadTasks}
        />

        <ColumnDialog
          open={columnDialogOpen}
          onOpenChange={setColumnDialogOpen}
          boardId={boardId!}
          onColumnCreated={loadColumns}
          existingColumnsCount={columns.length}
        />

        <BoardSettingsDialog
          open={settingsDialogOpen}
          onOpenChange={setSettingsDialogOpen}
          boardId={boardId!}
          columns={columns}
          onRulesChange={loadRules}
        />

        {pendingMove && (
          <DateChangeDialog
            open={dateChangeDialogOpen}
            onConfirm={handleDateChangeConfirm}
            onCancel={handleDateChangeCancel}
            taskTitle={tasks.find(t => t.id === pendingMove.taskId)?.title || ""}
            currentDate={tasks.find(t => t.id === pendingMove.taskId)?.due_date || ""}
          />
        )}
      </div>
    </div>
  );
}
