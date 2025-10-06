import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Only accept POST requests
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { apikey, board_id, column_id, title, description, due_date } = await req.json();

    // Validate required fields
    if (!apikey) {
      return new Response(
        JSON.stringify({ error: 'API key is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!board_id || !column_id) {
      return new Response(
        JSON.stringify({ error: 'board_id and column_id are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!title || title.trim() === '') {
      return new Response(
        JSON.stringify({ error: 'title is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate API key and get user_id
    const { data: apiKeyData, error: apiKeyError } = await supabase
      .from('api_keys')
      .select('user_id')
      .eq('key', apikey)
      .single();

    if (apiKeyError || !apiKeyData) {
      console.error('API key validation error:', apiKeyError);
      return new Response(
        JSON.stringify({ error: 'Invalid API key' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update last_used_at for the API key
    await supabase
      .from('api_keys')
      .update({ last_used_at: new Date().toISOString() })
      .eq('key', apikey);

    // Verify user owns the board
    const { data: boardData, error: boardError } = await supabase
      .from('boards')
      .select('id')
      .eq('id', board_id)
      .eq('user_id', apiKeyData.user_id)
      .single();

    if (boardError || !boardData) {
      console.error('Board verification error:', boardError);
      return new Response(
        JSON.stringify({ error: 'Board not found or access denied' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify column belongs to the board
    const { data: columnData, error: columnError } = await supabase
      .from('columns')
      .select('id')
      .eq('id', column_id)
      .eq('board_id', board_id)
      .single();

    if (columnError || !columnData) {
      console.error('Column verification error:', columnError);
      return new Response(
        JSON.stringify({ error: 'Column not found in the specified board' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get the highest position for the new task
    const { data: existingTasks } = await supabase
      .from('tasks')
      .select('position')
      .eq('column_id', column_id)
      .order('position', { ascending: false })
      .limit(1);

    const newPosition = existingTasks && existingTasks.length > 0 
      ? existingTasks[0].position + 1 
      : 0;

    // Create the task
    const { data: taskData, error: taskError } = await supabase
      .from('tasks')
      .insert({
        column_id,
        title: title.trim(),
        description: description || null,
        due_date: due_date || null,
        position: newPosition
      })
      .select()
      .single();

    if (taskError) {
      console.error('Task creation error:', taskError);
      return new Response(
        JSON.stringify({ error: 'Failed to create task', details: taskError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Task created successfully:', taskData.id);

    return new Response(
      JSON.stringify({ 
        success: true, 
        task: taskData,
        message: 'Task created successfully'
      }),
      { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
