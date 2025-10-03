import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

type ColumnDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  boardId: string;
  onColumnCreated: () => void;
  existingColumnsCount: number;
};

export function ColumnDialog({ open, onOpenChange, boardId, onColumnCreated, existingColumnsCount }: ColumnDialogProps) {
  const [title, setTitle] = useState("");

  const createColumn = async () => {
    if (!title.trim()) {
      toast({
        title: "Error",
        description: "Column title is required",
        variant: "destructive"
      });
      return;
    }

    const { error } = await supabase
      .from("columns")
      .insert({
        board_id: boardId,
        title,
        position: existingColumnsCount
      });

    if (error) {
      toast({
        title: "Error",
        description: "Failed to create column",
        variant: "destructive"
      });
    } else {
      toast({
        title: "Success",
        description: "Column created"
      });
      setTitle("");
      onOpenChange(false);
      onColumnCreated();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create New Column</DialogTitle>
          <DialogDescription>Add a new column to your board</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="column-title">Title</Label>
            <Input
              id="column-title"
              placeholder="Column title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <Button onClick={createColumn} className="w-full">
            Create Column
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
