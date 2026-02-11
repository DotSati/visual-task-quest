import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

type Task = {
  id: string;
  column_id: string;
  due_date: string | null;
};

type AutomationRule = {
  id: string;
  source_column_id: string;
  target_column_id: string;
  enabled: boolean;
};

export function useAutomation(
  boardId: string | undefined,
  tasks: Task[],
  onTasksUpdated: () => void
) {
  const lastCheckRef = useRef<Date>(new Date());
  const rulesRef = useRef<AutomationRule[]>([]);
  const [rules, setRules] = useState<AutomationRule[]>([]);

  const loadRules = async () => {
    if (!boardId) return;

    const { data, error } = await supabase
      .from("automation_rules")
      .select("*")
      .eq("board_id", boardId)
      .eq("enabled", true);

    if (!error && data) {
      rulesRef.current = data;
      setRules(data);
    }
  };

  const checkAndMoveOverdueTasks = async () => {
    if (!boardId || rulesRef.current.length === 0 || tasks.length === 0) return;

    const now = new Date();
    const today = now.toISOString().split("T")[0];

    // Find tasks that are overdue (due_date is today or earlier)
    const overdueTasks = tasks.filter((task) => {
      if (!task.due_date) return false;
      return task.due_date <= today;
    });

    if (overdueTasks.length === 0) return;

    // Group tasks by column for batch updates
    const tasksToMove: Array<{ taskId: string; targetColumnId: string }> = [];

    overdueTasks.forEach((task) => {
      // Find a rule that matches this task's current column
      const rule = rulesRef.current.find(
        (r) => r.source_column_id === task.column_id
      );

      if (rule) {
        tasksToMove.push({
          taskId: task.id,
          targetColumnId: rule.target_column_id,
        });
      }
    });

    // Move all tasks that match rules
    if (tasksToMove.length > 0) {
      const promises = tasksToMove.map(({ taskId, targetColumnId }) =>
        supabase
          .from("tasks")
          .update({ column_id: targetColumnId })
          .eq("id", taskId)
      );

      const results = await Promise.all(promises);
      const failures = results.filter((r) => r.error);

      if (failures.length === 0 && tasksToMove.length > 0) {
        toast({
          title: "Tasks Moved",
          description: `${tasksToMove.length} overdue task(s) moved automatically`,
        });
        onTasksUpdated();
      }
    }

    lastCheckRef.current = now;
  };

  useEffect(() => {
    loadRules();
  }, [boardId]);

  useEffect(() => {
    // Check immediately on mount
    checkAndMoveOverdueTasks();

    // Set up interval to check every minute
    const interval = setInterval(() => {
      checkAndMoveOverdueTasks();
    }, 60000); // Check every 60 seconds

    return () => clearInterval(interval);
  }, [boardId, tasks]);

  return { loadRules, rules };
}
