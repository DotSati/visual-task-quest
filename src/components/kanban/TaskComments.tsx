import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { Loader2, Paperclip, Send, Trash2, Download } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { MarkdownRenderer } from "./MarkdownRenderer";
import { Input } from "@/components/ui/input";

interface Comment {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
  attachments?: {
    id: string;
    file_name: string;
    file_path: string;
    file_size: number;
    mime_type: string | null;
  }[];
}

interface TaskCommentsProps {
  taskId: string;
}

export const TaskComments = ({ taskId }: TaskCommentsProps) => {
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<FileList | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    fetchComments();
    fetchCurrentUser();
  }, [taskId]);

  const fetchCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setCurrentUserId(user?.id || null);
  };

  const fetchComments = async () => {
    setIsLoading(true);
    const { data: commentsData, error } = await supabase
      .from("task_comments")
      .select("*")
      .eq("task_id", taskId)
      .order("created_at", { ascending: true });

    if (error) {
      toast({
        title: "Error",
        description: "Failed to load comments",
        variant: "destructive",
      });
      setIsLoading(false);
      return;
    }

    // Fetch attachments for each comment
    const commentsWithAttachments = await Promise.all(
      (commentsData || []).map(async (comment) => {
        const { data: attachments } = await supabase
          .from("comment_attachments")
          .select("*")
          .eq("comment_id", comment.id);

        return {
          ...comment,
          attachments: attachments || [],
        };
      })
    );

    setComments(commentsWithAttachments);
    setIsLoading(false);
  };

  const handleSubmit = async () => {
    if (!newComment.trim() && !selectedFiles?.length) {
      toast({
        title: "Error",
        description: "Please enter a comment or attach a file",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast({
        title: "Error",
        description: "You must be logged in to comment",
        variant: "destructive",
      });
      setIsSubmitting(false);
      return;
    }

    // Create comment
    const { data: comment, error: commentError } = await supabase
      .from("task_comments")
      .insert({
        task_id: taskId,
        user_id: user.id,
        content: newComment.trim() || "(attachment only)",
      })
      .select()
      .single();

    if (commentError || !comment) {
      toast({
        title: "Error",
        description: "Failed to add comment",
        variant: "destructive",
      });
      setIsSubmitting(false);
      return;
    }

    // Upload files if any
    if (selectedFiles && selectedFiles.length > 0) {
      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        const filePath = `${user.id}/${comment.id}/${Date.now()}_${file.name}`;

        const { error: uploadError } = await supabase.storage
          .from("task-files")
          .upload(filePath, file);

        if (uploadError) {
          console.error("Upload error:", uploadError);
          continue;
        }

        // Create attachment record
        await supabase.from("comment_attachments").insert({
          comment_id: comment.id,
          file_name: file.name,
          file_path: filePath,
          file_size: file.size,
          mime_type: file.type,
          uploaded_by: user.id,
        });
      }
    }

    toast({
      title: "Success",
      description: "Comment added",
    });

    setNewComment("");
    setSelectedFiles(null);
    const fileInput = document.getElementById("comment-file-input") as HTMLInputElement;
    if (fileInput) fileInput.value = "";
    
    fetchComments();
    setIsSubmitting(false);
  };

  const handleDeleteComment = async (commentId: string) => {
    const { error } = await supabase
      .from("task_comments")
      .delete()
      .eq("id", commentId);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to delete comment",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Success",
      description: "Comment deleted",
    });

    fetchComments();
  };

  const handleDownloadAttachment = async (filePath: string, fileName: string) => {
    const { data, error } = await supabase.storage
      .from("task-files")
      .download(filePath);

    if (error || !data) {
      toast({
        title: "Error",
        description: "Failed to download file",
        variant: "destructive",
      });
      return;
    }

    const url = URL.createObjectURL(data);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Comments</h3>

      {/* Comments list */}
      <div className="space-y-4 max-h-96 overflow-y-auto">
        {comments.length === 0 ? (
          <p className="text-sm text-muted-foreground">No comments yet</p>
        ) : (
          comments.map((comment) => (
            <div key={comment.id} className="border rounded-lg p-4 space-y-2">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="text-xs text-muted-foreground mb-2">
                    {formatDistanceToNow(new Date(comment.created_at), {
                      addSuffix: true,
                    })}
                  </div>
                  <div className="prose prose-sm dark:prose-invert max-w-none">
                    <MarkdownRenderer content={comment.content} />
                  </div>
                  
                  {comment.attachments && comment.attachments.length > 0 && (
                    <div className="mt-3 space-y-2">
                      {comment.attachments.map((attachment) => (
                        <div
                          key={attachment.id}
                          className="flex items-center gap-2 text-sm bg-muted p-2 rounded"
                        >
                          <Paperclip className="h-4 w-4" />
                          <span className="flex-1 truncate">{attachment.file_name}</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              handleDownloadAttachment(
                                attachment.file_path,
                                attachment.file_name
                              )
                            }
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {currentUserId === comment.user_id && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteComment(comment.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add comment form */}
      <div className="space-y-2 pt-4 border-t">
        <Textarea
          placeholder="Write a comment... (Markdown supported)"
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          rows={3}
        />
        
        <div className="flex items-center gap-2">
          <Input
            id="comment-file-input"
            type="file"
            multiple
            onChange={(e) => setSelectedFiles(e.target.files)}
            className="flex-1"
          />
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="gap-2"
          >
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            Send
          </Button>
        </div>
        
        {selectedFiles && selectedFiles.length > 0 && (
          <p className="text-xs text-muted-foreground">
            {selectedFiles.length} file(s) selected
          </p>
        )}
      </div>
    </div>
  );
};
