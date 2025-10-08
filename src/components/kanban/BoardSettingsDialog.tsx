import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Trash2, Plus } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

type Column = {
  id: string;
  title: string;
  position: number;
};

type AutomationRule = {
  id: string;
  board_id: string;
  source_column_id: string;
  target_column_id: string;
  trigger_type: string;
  enabled: boolean;
};

interface BoardSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  boardId: string;
  columns: Column[];
  onRulesChange: () => void;
}

export function BoardSettingsDialog({
  open,
  onOpenChange,
  boardId,
  columns,
  onRulesChange,
}: BoardSettingsDialogProps) {
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [loading, setLoading] = useState(false);
  const [newRule, setNewRule] = useState({
    sourceColumnId: "",
    targetColumnId: "",
  });

  useEffect(() => {
    if (open) {
      loadRules();
    }
  }, [open, boardId]);

  const loadRules = async () => {
    const { data, error } = await supabase
      .from("automation_rules")
      .select("*")
      .eq("board_id", boardId);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to load automation rules",
        variant: "destructive",
      });
    } else {
      setRules(data || []);
    }
  };

  const addRule = async () => {
    if (!newRule.sourceColumnId || !newRule.targetColumnId) {
      toast({
        title: "Error",
        description: "Please select both source and target columns",
        variant: "destructive",
      });
      return;
    }

    if (newRule.sourceColumnId === newRule.targetColumnId) {
      toast({
        title: "Error",
        description: "Source and target columns must be different",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    const { error } = await supabase.from("automation_rules").insert({
      board_id: boardId,
      source_column_id: newRule.sourceColumnId,
      target_column_id: newRule.targetColumnId,
      trigger_type: "due_date_reached",
      enabled: true,
    });

    if (error) {
      toast({
        title: "Error",
        description: "Failed to create automation rule",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: "Automation rule created",
      });
      setNewRule({ sourceColumnId: "", targetColumnId: "" });
      loadRules();
      onRulesChange();
    }
    setLoading(false);
  };

  const deleteRule = async (ruleId: string) => {
    const { error } = await supabase
      .from("automation_rules")
      .delete()
      .eq("id", ruleId);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to delete automation rule",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: "Automation rule deleted",
      });
      loadRules();
      onRulesChange();
    }
  };

  const toggleRule = async (ruleId: string, enabled: boolean) => {
    const { error } = await supabase
      .from("automation_rules")
      .update({ enabled })
      .eq("id", ruleId);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to update automation rule",
        variant: "destructive",
      });
    } else {
      loadRules();
      onRulesChange();
    }
  };

  const getColumnName = (columnId: string) => {
    return columns.find((c) => c.id === columnId)?.title || "Unknown";
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Board Automation Settings</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <div>
            <h3 className="text-sm font-medium mb-4">
              Automatic Task Movement Rules
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              Configure rules to automatically move tasks between columns when
              their due date is reached.
            </p>

            <div className="space-y-3">
              {rules.map((rule) => (
                <div
                  key={rule.id}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="flex items-center gap-3 flex-1">
                    <Switch
                      checked={rule.enabled}
                      onCheckedChange={(enabled) => toggleRule(rule.id, enabled)}
                    />
                    <div className="flex-1">
                      <p className="text-sm">
                        Move from{" "}
                        <span className="font-medium">
                          {getColumnName(rule.source_column_id)}
                        </span>{" "}
                        to{" "}
                        <span className="font-medium">
                          {getColumnName(rule.target_column_id)}
                        </span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        When due date is reached
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteRule(rule.id)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}

              {rules.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No automation rules configured
                </p>
              )}
            </div>
          </div>

          <div className="border-t pt-4">
            <h4 className="text-sm font-medium mb-3">Add New Rule</h4>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground mb-1.5 block">
                    From Column
                  </Label>
                  <Select
                    value={newRule.sourceColumnId}
                    onValueChange={(value) =>
                      setNewRule({ ...newRule, sourceColumnId: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select column" />
                    </SelectTrigger>
                    <SelectContent>
                      {columns.map((column) => (
                        <SelectItem key={column.id} value={column.id}>
                          {column.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground mb-1.5 block">
                    To Column
                  </Label>
                  <Select
                    value={newRule.targetColumnId}
                    onValueChange={(value) =>
                      setNewRule({ ...newRule, targetColumnId: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select column" />
                    </SelectTrigger>
                    <SelectContent>
                      {columns.map((column) => (
                        <SelectItem key={column.id} value={column.id}>
                          {column.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button
                onClick={addRule}
                disabled={loading}
                className="w-full"
                size="sm"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Rule
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
