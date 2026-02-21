import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Find tasks with notification_at <= now and notification_sent = false
    const now = new Date().toISOString();
    const { data: tasks, error: tasksError } = await supabase
      .from('tasks')
      .select(`
        id, title, description, due_date, notification_at,
        column_id,
        columns!inner(board_id, title,
          boards!inner(user_id, title)
        )
      `)
      .eq('notification_sent', false)
      .not('notification_at', 'is', null)
      .lte('notification_at', now);

    if (tasksError) {
      console.error('Error fetching tasks:', tasksError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch tasks' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!tasks || tasks.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No notifications to send', sent: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let sentCount = 0;

    for (const task of tasks) {
      const column = task.columns as any;
      const board = column.boards;
      const userId = board.user_id;

      // Get user's notification URL
      const { data: profile } = await supabase
        .from('profiles')
        .select('notification_url, email')
        .eq('id', userId)
        .single();

      if (!profile?.notification_url) {
        // Mark as sent to avoid retrying tasks with no URL configured
        await supabase
          .from('tasks')
          .update({ notification_sent: true })
          .eq('id', task.id);
        continue;
      }

      const payload = {
        subject: task.title,
        message: task.description || '',
        board: board.title,
        column: column.title,
        due_date: task.due_date,
        notification_at: task.notification_at,
        task_id: task.id,
      };

      try {
        const response = await fetch(profile.notification_url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        console.log(`Notification sent for task "${task.title}" to ${profile.notification_url}: ${response.status}`);

        // Mark notification as sent
        await supabase
          .from('tasks')
          .update({ notification_sent: true })
          .eq('id', task.id);

        sentCount++;
      } catch (fetchError) {
        console.error(`Failed to send notification for task "${task.title}":`, fetchError);
      }
    }

    return new Response(
      JSON.stringify({ message: `Sent ${sentCount} notifications`, sent: sentCount }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
