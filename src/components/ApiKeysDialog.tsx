import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Copy, Trash2, Plus } from "lucide-react";
import { format } from "date-fns";

type ApiKey = {
  id: string;
  name: string;
  key: string; // Now stores masked version only (sk_xxxxx...xxxx)
  key_hash: string | null;
  created_at: string;
  last_used_at: string | null;
};

type ApiKeysDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function ApiKeysDialog({ open, onOpenChange }: ApiKeysDialogProps) {
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [showNewKeyDialog, setShowNewKeyDialog] = useState(false);
  const [newlyCreatedKey, setNewlyCreatedKey] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [keyToDelete, setKeyToDelete] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      loadApiKeys();
    }
  }, [open]);

  const loadApiKeys = async () => {
    setLoading(true);
    const { data: session } = await supabase.auth.getSession();
    if (!session.session?.user) return;

    const { data, error } = await supabase
      .from("api_keys")
      .select("*")
      .eq("user_id", session.session.user.id)
      .order("created_at", { ascending: false });

    if (error) {
      toast({
        title: "Error",
        description: "Failed to load API keys",
        variant: "destructive",
      });
    } else {
      setApiKeys(data || []);
    }
    setLoading(false);
  };

  const generateApiKey = () => {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = 'sk_';
    for (let i = 0; i < 48; i++) {
      result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return result;
  };

  const createApiKey = async () => {
    if (!newKeyName.trim()) {
      toast({
        title: "Error",
        description: "Please enter a name for the API key",
        variant: "destructive",
      });
      return;
    }

    const { data: session } = await supabase.auth.getSession();
    if (!session.session?.user) return;

    const newKey = generateApiKey();
    
    // Hash the key for secure storage (using SHA-256 via Supabase function)
    const { data: hashData, error: hashError } = await supabase
      .rpc('hash_api_key', { api_key: newKey });
    
    if (hashError) {
      toast({
        title: "Error",
        description: "Failed to generate API key hash",
        variant: "destructive",
      });
      return;
    }

    const { error } = await supabase
      .from("api_keys")
      .insert({
        user_id: session.session.user.id,
        name: newKeyName.trim(),
        key: `${newKey.substring(0, 10)}...${newKey.substring(newKey.length - 4)}`, // Store masked version for display only
        key_hash: hashData, // Store the hash for verification
      });

    if (error) {
      toast({
        title: "Error",
        description: "Failed to create API key",
        variant: "destructive",
      });
    } else {
      setNewlyCreatedKey(newKey);
      setShowNewKeyDialog(true);
      setNewKeyName("");
      loadApiKeys();
    }
  };

  const deleteApiKey = async () => {
    if (!keyToDelete) return;

    const { error } = await supabase
      .from("api_keys")
      .delete()
      .eq("id", keyToDelete);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to delete API key",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: "API key deleted",
      });
      loadApiKeys();
    }
    setDeleteDialogOpen(false);
    setKeyToDelete(null);
  };

  const copyNewKeyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied",
      description: "API key copied to clipboard",
    });
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>API Keys</DialogTitle>
            <DialogDescription>
              Manage your API keys for programmatic access to create tasks.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex gap-2">
              <div className="flex-1">
                <Label htmlFor="keyName">New API Key Name</Label>
                <Input
                  id="keyName"
                  placeholder="e.g., Production Server"
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      createApiKey();
                    }
                  }}
                />
              </div>
              <div className="flex items-end">
                <Button onClick={createApiKey}>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Key
                </Button>
              </div>
            </div>

            {loading ? (
              <div className="text-center py-8 text-muted-foreground">Loading...</div>
            ) : apiKeys.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No API keys yet. Create one to get started.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Key</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Last Used</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {apiKeys.map((apiKey) => (
                    <TableRow key={apiKey.id}>
                      <TableCell className="font-medium">{apiKey.name}</TableCell>
                      <TableCell className="font-mono text-xs">
                        <span className="text-muted-foreground">
                          {apiKey.key}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {format(new Date(apiKey.created_at), "MMM d, yyyy")}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {apiKey.last_used_at
                          ? format(new Date(apiKey.last_used_at), "MMM d, yyyy")
                          : "Never"}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                          onClick={() => {
                            setKeyToDelete(apiKey.id);
                            setDeleteDialogOpen(true);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showNewKeyDialog} onOpenChange={setShowNewKeyDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>API Key Created</AlertDialogTitle>
            <AlertDialogDescription>
              Make sure to copy your API key now. You won't be able to see it again!
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="bg-muted p-4 rounded-md font-mono text-sm break-all">
            {newlyCreatedKey}
          </div>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => {
              if (newlyCreatedKey) {
                copyNewKeyToClipboard(newlyCreatedKey);
              }
              setShowNewKeyDialog(false);
              setNewlyCreatedKey(null);
            }}>
              Copy & Close
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete API Key</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this API key? This action cannot be undone and any applications using this key will stop working.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setKeyToDelete(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={deleteApiKey}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
