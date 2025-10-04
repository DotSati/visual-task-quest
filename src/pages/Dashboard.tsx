import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { Plus, LogOut, Trash2 } from "lucide-react";
import { Session, User } from "@supabase/supabase-js";

type Board = {
  id: string;
  title: string;
  description: string | null;
  created_at: string;
};

export default function Dashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [boards, setBoards] = useState<Board[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newBoardTitle, setNewBoardTitle] = useState("");
  const [newBoardDescription, setNewBoardDescription] = useState("");

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, currentSession) => {
        setSession(currentSession);
        setUser(currentSession?.user ?? null);
        if (!currentSession) {
          navigate("/auth");
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      setSession(currentSession);
      setUser(currentSession?.user ?? null);
      if (!currentSession) {
        navigate("/auth");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  useEffect(() => {
    if (user) {
      loadBoards();
    }
  }, [user]);

  const loadBoards = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("boards")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      toast({
        title: "Error",
        description: "Failed to load boards",
        variant: "destructive"
      });
    } else {
      setBoards(data || []);
    }
    setLoading(false);
  };

  const createBoard = async () => {
    if (!newBoardTitle.trim()) {
      toast({
        title: "Error",
        description: "Board title is required",
        variant: "destructive"
      });
      return;
    }

    const { data: board, error } = await supabase
      .from("boards")
      .insert({
        title: newBoardTitle,
        description: newBoardDescription || null,
        user_id: user!.id
      })
      .select()
      .single();

    if (error) {
      toast({
        title: "Error",
        description: "Failed to create board",
        variant: "destructive"
      });
      return;
    }

    // Create default columns
    const defaultColumns = [
      { title: "To Do", position: 0 },
      { title: "In Progress", position: 1 },
      { title: "Done", position: 2 }
    ];

    const { error: columnsError } = await supabase
      .from("columns")
      .insert(
        defaultColumns.map(col => ({
          board_id: board.id,
          title: col.title,
          position: col.position
        }))
      );

    if (columnsError) {
      toast({
        title: "Warning",
        description: "Board created but default columns failed",
        variant: "destructive"
      });
    }

    setDialogOpen(false);
    setNewBoardTitle("");
    setNewBoardDescription("");
    loadBoards();
    toast({
      title: "Success",
      description: "Board created successfully"
    });
  };

  const deleteBoard = async (boardId: string) => {
    const { error } = await supabase
      .from("boards")
      .delete()
      .eq("id", boardId);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to delete board",
        variant: "destructive"
      });
    } else {
      loadBoards();
      toast({
        title: "Success",
        description: "Board deleted successfully"
      });
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-2xl font-bold gradient-text">My Boards</h1>
          <div className="flex gap-2">
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="w-4 h-4 mr-2" />
                  New Board
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create New Board</DialogTitle>
                  <DialogDescription>
                    Create a new Kanban board to organize your tasks
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="title">Title</Label>
                    <Input
                      id="title"
                      placeholder="My Project"
                      value={newBoardTitle}
                      onChange={(e) => setNewBoardTitle(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description">Description (optional)</Label>
                    <Textarea
                      id="description"
                      placeholder="What is this board for?"
                      value={newBoardDescription}
                      onChange={(e) => setNewBoardDescription(e.target.value)}
                    />
                  </div>
                  <Button onClick={createBoard} className="w-full">
                    Create Board
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
            <Button variant="outline" size="sm" onClick={handleSignOut}>
              <LogOut className="w-4 h-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </div>

        {boards.length === 0 ? (
          <Card className="p-8 text-center">
            <CardHeader className="p-4">
              <CardTitle className="text-lg">No boards yet</CardTitle>
              <CardDescription className="text-sm">
                Create your first board to get started
              </CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {boards.map((board) => (
              <Card
                key={board.id}
                className="hover:border-primary transition-colors cursor-pointer group"
              >
                <CardHeader className="p-4" onClick={() => navigate(`/board/${board.id}`)}>
                  <CardTitle className="text-base">{board.title}</CardTitle>
                  {board.description && (
                    <CardDescription className="text-xs line-clamp-2">{board.description}</CardDescription>
                  )}
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteBoard(board.id);
                    }}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
