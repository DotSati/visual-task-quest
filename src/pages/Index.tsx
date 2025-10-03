import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

const Index = () => {
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        navigate("/dashboard");
      }
    });
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-6 p-8">
        <h1 className="text-6xl font-bold gradient-text mb-4">
          Kanbandot
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          A modern Kanban board application for managing your tasks and projects
        </p>
        <Button size="lg" className="mt-8" onClick={() => navigate("/auth")}>
          Get Started
        </Button>
      </div>
    </div>
  );
};

export default Index;
