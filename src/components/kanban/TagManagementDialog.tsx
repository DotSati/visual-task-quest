import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Trash2, Edit2, Check, X } from "lucide-react";

type Tag = {
  id: string;
  name: string;
  color: string | null;
};

type TagManagementDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function TagManagementDialog({ open, onOpenChange }: TagManagementDialogProps) {
  const [tags, setTags] = useState<Tag[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("");

  useEffect(() => {
    if (open) {
      loadTags();
    }
  }, [open]);

  const loadTags = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from("tags")
      .select("*")
      .eq("user_id", user.id)
      .order("name");

    if (!error && data) {
      setTags(data);
    }
  };

  const startEditing = (tag: Tag) => {
    setEditingId(tag.id);
    setEditName(tag.name);
    setEditColor(tag.color || "#3b82f6");
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditName("");
    setEditColor("");
  };

  const saveTag = async (tagId: string) => {
    if (!editName.trim()) {
      toast({
        title: "Error",
        description: "Tag name cannot be empty",
        variant: "destructive"
      });
      return;
    }

    const { error } = await supabase
      .from("tags")
      .update({ 
        name: editName.trim(),
        color: editColor 
      })
      .eq("id", tagId);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to update tag",
        variant: "destructive"
      });
    } else {
      toast({
        title: "Success",
        description: "Tag updated successfully"
      });
      loadTags();
      cancelEditing();
    }
  };

  const deleteTag = async (tagId: string) => {
    const { error } = await supabase
      .from("tags")
      .delete()
      .eq("id", tagId);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to delete tag",
        variant: "destructive"
      });
    } else {
      toast({
        title: "Success",
        description: "Tag deleted successfully"
      });
      loadTags();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Manage Tags</DialogTitle>
          <DialogDescription>Edit or delete your tags</DialogDescription>
        </DialogHeader>
        
        <div className="space-y-2">
          {tags.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No tags yet. Create tags by adding them to tasks.
            </p>
          ) : (
            tags.map((tag) => (
              <div
                key={tag.id}
                className="p-3 border rounded-md space-y-2"
              >
                {editingId === tag.id ? (
                  <>
                    <div className="space-y-2">
                      <Label>Name</Label>
                      <Input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        placeholder="Tag name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Color</Label>
                      <Input
                        type="color"
                        value={editColor}
                        onChange={(e) => setEditColor(e.target.value)}
                        className="w-full h-10 cursor-pointer"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => saveTag(tag.id)}
                        className="flex-1"
                      >
                        <Check className="h-4 w-4 mr-1" />
                        Save
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={cancelEditing}
                        className="flex-1"
                      >
                        <X className="h-4 w-4 mr-1" />
                        Cancel
                      </Button>
                    </div>
                  </>
                ) : (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-6 h-6 rounded border"
                        style={{ backgroundColor: tag.color || "#3b82f6" }}
                      />
                      <span className="font-medium">{tag.name}</span>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => startEditing(tag)}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => deleteTag(tag.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
