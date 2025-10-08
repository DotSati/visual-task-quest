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
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, ArrowRight } from "lucide-react";

type Column = {
  id: string;
  title: string;
  position: number;
  board_id: string;
  sort_order: string | null;
};

type AutomationRule = {
  id: string;
  board_id: string;
  source_column_id: string;
  target_column_id: string;
  trigger_type: string;
  enabled: boolean;
};

interface AutomationSettingsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  boardId: string;
  columns: Column[];
}

export function AutomationSettings({
  open,
  onOpenChange,
  boardId,
  columns,
}: AutomationSettingsProps) {
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [newRule, setNewRule] = useState({
    source_column_id: "",
    target_column_id: "",
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
    if (!newRule.source_column_id || !newRule.target_column_id) {
      toast({
        title: "Error",
        description: "Please select both source and target columns",
        variant: "destructive",
      });
      return;
    }

    if (newRule.source_column_id === newRule.target_column_id) {
      toast({
        title: "Error",
        description: "Source and target columns must be different",
        variant: "destructive",
      });
      return;
    }

    const { error } = await supabase.from("automation_rules").insert({
      board_id: boardId,
      source_column_id: newRule.source_column_id,
      target_column_id: newRule.target_column_id,
      trigger_type: "due_date_reached",
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
      setNewRule({ source_column_id: "", target_column_id: "" });
      loadRules();
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
        description: "Failed to update rule",
        variant: "destructive",
      });
    } else {
      loadRules();
    }
  };

  const deleteRule = async (ruleId: string) => {
    const { error } = await supabase
      .from("automation_rules")
      .delete()
      .eq("id", ruleId);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to delete rule",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: "Automation rule deleted",
      });
      loadRules();
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
            <h3 className="text-sm font-medium mb-3">
              Active Automation Rules
            </h3>
            {rules.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No automation rules configured yet.
              </p>
            ) : (
              <div className="space-y-3">
                {rules.map((rule) => (
                  <div
                    key={rule.id}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div className="flex items-center gap-3 flex-1">
                      <Switch
                        checked={rule.enabled}
                        onCheckedChange={(checked) =>
                          toggleRule(rule.id, checked)
                        }
                      />
                      <div className="flex items-center gap-2 text-sm">
                        <span className="font-medium">
                          {getColumnName(rule.source_column_id)}
                        </span>
                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">
                          {getColumnName(rule.target_column_id)}
                        </span>
                        <span className="text-muted-foreground">
                          when due date is reached
                        </span>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteRule(rule.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="border-t pt-6">
            <h3 className="text-sm font-medium mb-3">Add New Rule</h3>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Source Column</Label>
                  <Select
                    value={newRule.source_column_id}
                    onValueChange={(value) =>
                      setNewRule({ ...newRule, source_column_id: value })
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

                <div className="space-y-2">
                  <Label>Target Column</Label>
                  <Select
                    value={newRule.target_column_id}
                    onValueChange={(value) =>
                      setNewRule({ ...newRule, target_column_id: value })
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

              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>When due date is reached in</span>
                <span className="font-medium text-foreground">
                  {newRule.source_column_id
                    ? getColumnName(newRule.source_column_id)
                    : "source"}
                </span>
                <ArrowRight className="h-4 w-4" />
                <span>move to</span>
                <span className="font-medium text-foreground">
                  {newRule.target_column_id
                    ? getColumnName(newRule.target_column_id)
                    : "target"}
                </span>
              </div>

              <Button onClick={addRule} className="w-full">
                <Plus className="h-4 w-4 mr-2" />
                Add Automation Rule
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
