import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { Filter, X } from "lucide-react";
import { cn } from "@/lib/utils";

type Tag = {
  id: string;
  name: string;
  color: string | null;
};

type TagFilterProps = {
  boardId: string;
  selectedTagIds: string[];
  onFilterChange: (tagIds: string[]) => void;
};

export function TagFilter({ boardId, selectedTagIds, onFilterChange }: TagFilterProps) {
  const [tags, setTags] = useState<Tag[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    loadTags();
  }, [boardId]);

  const loadTags = async () => {
    const { data: session } = await supabase.auth.getSession();
    if (!session.session?.user) return;

    const { data, error } = await supabase
      .from("tags")
      .select("*")
      .eq("user_id", session.session.user.id)
      .order("name");

    if (!error && data) {
      setTags(data);
    }
  };

  const toggleTag = (tagId: string) => {
    if (selectedTagIds.includes(tagId)) {
      onFilterChange(selectedTagIds.filter(id => id !== tagId));
    } else {
      onFilterChange([...selectedTagIds, tagId]);
    }
  };

  const clearFilter = () => {
    onFilterChange([]);
  };

  const selectedTags = tags.filter(tag => selectedTagIds.includes(tag.id));

  return (
    <div className="flex items-center gap-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="gap-1.5">
            <Filter className="w-4 h-4" />
            Filter by Tags
            {selectedTagIds.length > 0 && (
              <Badge variant="secondary" className="ml-1 px-1.5 py-0 text-xs">
                {selectedTagIds.length}
              </Badge>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-3" align="end">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Filter by Tags</span>
              {selectedTagIds.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs"
                  onClick={clearFilter}
                >
                  Clear all
                </Button>
              )}
            </div>
            {tags.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">No tags available</p>
            ) : (
              <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto">
                {tags.map((tag) => (
                  <Badge
                    key={tag.id}
                    variant={selectedTagIds.includes(tag.id) ? "default" : "outline"}
                    className={cn(
                      "cursor-pointer transition-colors",
                      selectedTagIds.includes(tag.id) && "ring-2 ring-ring ring-offset-1"
                    )}
                    style={{
                      backgroundColor: selectedTagIds.includes(tag.id) 
                        ? tag.color || undefined 
                        : "transparent",
                      borderColor: tag.color || undefined,
                      color: selectedTagIds.includes(tag.id) 
                        ? (tag.color ? "#fff" : undefined)
                        : tag.color || undefined
                    }}
                    onClick={() => toggleTag(tag.id)}
                  >
                    {tag.name}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </PopoverContent>
      </Popover>

      {/* Show selected tags as badges outside the popover */}
      {selectedTags.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap">
          {selectedTags.map((tag) => (
            <Badge
              key={tag.id}
              variant="secondary"
              className="gap-1 pr-1"
              style={{
                backgroundColor: tag.color || undefined,
                color: tag.color ? "#fff" : undefined
              }}
            >
              {tag.name}
              <Button
                variant="ghost"
                size="sm"
                className="h-4 w-4 p-0 hover:bg-transparent"
                onClick={() => toggleTag(tag.id)}
              >
                <X className="h-3 w-3" />
              </Button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
