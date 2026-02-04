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

    const { apikey, column_id, title, description, due_date } = await req.json();

    // Validate required fields
    if (!apikey) {
      return new Response(
        JSON.stringify({ error: 'API key is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!column_id) {
      return new Response(
        JSON.stringify({ error: 'column_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!title || title.trim() === '') {
      return new Response(
        JSON.stringify({ error: 'title is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Hash the incoming API key to compare against stored hashes
    const incomingKeyHash = await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(apikey)
    );
    const hashHex = Array.from(new Uint8Array(incomingKeyHash))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    // Validate API key by comparing hash
    const { data: apiKeyData, error: apiKeyError } = await supabase
      .from('api_keys')
      .select('id, user_id, key_hash')
      .eq('key_hash', hashHex)
      .maybeSingle();

    if (apiKeyError || !apiKeyData) {
      console.error('API key validation error:', apiKeyError);
      return new Response(
        JSON.stringify({ error: 'Invalid API key' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update last_used_at for the API key (using id now, not the key)
    await supabase
      .from('api_keys')
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', apiKeyData.id);

    // Verify column exists and get its board_id
    const { data: columnData, error: columnError } = await supabase
      .from('columns')
      .select('id, board_id, boards!inner(user_id)')
      .eq('id', column_id)
      .maybeSingle();

    if (columnError || !columnData) {
      console.error('Column verification error:', columnError);
      return new Response(
        JSON.stringify({ error: 'Column not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify user owns the board that contains this column
    const boardData = columnData.boards as any;
    if (boardData.user_id !== apiKeyData.user_id) {
      return new Response(
        JSON.stringify({ error: 'Access denied to this column' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
