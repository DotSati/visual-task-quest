import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { ArrowLeft, ChevronDown, Settings } from "lucide-react";
import { DndContext, DragEndEvent, DragOverEvent, DragStartEvent, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { KanbanColumn } from "@/components/kanban/KanbanColumn";
import { TaskDialog } from "@/components/kanban/TaskDialog";
import { TaskEditDialog } from "@/components/kanban/TaskEditDialog";
import { ColumnDialog } from "@/components/kanban/ColumnDialog";
import { BoardSettingsDialog } from "@/components/kanban/BoardSettingsDialog";
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
      .order("created_at", { ascending: false });

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

  const { loadRules } = useAutomation(boardId, tasks, loadTasks);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    const activeTask = tasks.find(t => t.id === activeId);
    const overTask = tasks.find(t => t.id === overId);
    const overColumn = columns.find(c => c.id === overId);

    if (!activeTask) return;

    // Moving over another task in the same column
    if (overTask && activeTask.column_id === overTask.column_id) {
      const columnTasks = tasks.filter(t => t.column_id === activeTask.column_id);
      const oldIndex = columnTasks.findIndex(t => t.id === activeId);
      const newIndex = columnTasks.findIndex(t => t.id === overId);

      if (oldIndex !== newIndex) {
        const reorderedTasks = [...columnTasks];
        const [movedTask] = reorderedTasks.splice(oldIndex, 1);
        reorderedTasks.splice(newIndex, 0, movedTask);
        
        const otherTasks = tasks.filter(t => t.column_id !== activeTask.column_id);
        setTasks([...otherTasks, ...reorderedTasks]);
      }
    }
    // Moving over another task in a different column
    else if (overTask && activeTask.column_id !== overTask.column_id) {
      const targetColumnId = overTask.column_id;
      const newTasks = tasks.map(t =>
        t.id === activeId ? { ...t, column_id: targetColumnId } : t
      );
      setTasks(newTasks);
    }
    // Moving to an empty column or column header
    else if (overColumn && activeTask.column_id !== overColumn.id) {
      const newTasks = tasks.map(t =>
        t.id === activeId ? { ...t, column_id: overColumn.id } : t
      );
      setTasks(newTasks);
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const activeId = active.id as string;
    const activeTask = tasks.find(t => t.id === activeId);
    if (!activeTask) return;

    // Get all tasks in the target column and update their positions
    const columnTasks = tasks.filter(t => t.column_id === activeTask.column_id);
    
    // Update positions for all tasks in the column
    const updates = columnTasks.map((task, index) => ({
      id: task.id,
      column_id: activeTask.column_id,
      position: index
    }));

    // Batch update all tasks
    for (const update of updates) {
      await supabase
        .from("tasks")
        .update({
          column_id: update.column_id,
          position: update.position
        })
        .eq("id", update.id);
    }

    loadTasks();
  };

  const openNewTaskDialog = (columnId: string) => {
    setSelectedColumnId(columnId);
    setTaskDialogOpen(true);
  };

  const handleTaskEditClose = () => {
    setTaskEditOpen(false);
    setSelectedTaskId(null);
    setSearchParams({});
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
          <div className="flex gap-3 overflow-x-auto pb-4">
            {columns.map((column) => (
              <KanbanColumn
                key={column.id}
                column={column}
                tasks={tasks.filter(t => t.column_id === column.id)}
                onAddTask={() => openNewTaskDialog(column.id)}
                onTaskUpdate={loadTasks}
                onColumnDelete={loadColumns}
                onColumnUpdate={loadColumns}
                onTaskClick={(taskId) => {
                  setSearchParams({ task: taskId });
                }}
              />
            ))}
          </div>
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
      </div>
    </div>
  );
}
