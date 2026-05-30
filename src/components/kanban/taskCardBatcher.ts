import { supabase } from "@/integrations/supabase/client";

// Coalesces per-task queries from many TaskCard instances into a single
// Supabase request. Without this, rendering N cards triggers N parallel
// network calls per query (task_tags, task_attachments, task_comments,
// task_assignees), which can flood the browser/server and produce CORS /
// "request did not succeed" errors when URLs or connection limits are hit.

type Resolver<T> = (value: T) => void;
type Batch<T> = {
  ids: Set<string>;
  resolvers: Map<string, Resolver<T>[]>;
  timer: number | null;
};

const BATCH_WINDOW_MS = 30;
const CHUNK_SIZE = 100;

function createBatcher<T>(
  fetcher: (ids: string[]) => Promise<Record<string, T>>,
  empty: () => T,
) {
  const batch: Batch<T> = { ids: new Set(), resolvers: new Map(), timer: null };

  const flush = async () => {
    batch.timer = null;
    const ids = Array.from(batch.ids);
    const resolvers = batch.resolvers;
    batch.ids = new Set();
    batch.resolvers = new Map();
    if (ids.length === 0) return;

    let map: Record<string, T> = {};
    try {
      for (let i = 0; i < ids.length; i += CHUNK_SIZE) {
        const chunk = ids.slice(i, i + CHUNK_SIZE);
        const part = await fetcher(chunk);
        map = { ...map, ...part };
      }
    } catch (err) {
      console.error("taskCardBatcher fetch failed", err);
    }

    resolvers.forEach((list, id) => {
      const value = map[id] ?? empty();
      list.forEach((r) => r(value));
    });
  };

  return (id: string): Promise<T> => {
    return new Promise<T>((resolve) => {
      batch.ids.add(id);
      const list = batch.resolvers.get(id) ?? [];
      list.push(resolve);
      batch.resolvers.set(id, list);
      if (batch.timer === null) {
        batch.timer = window.setTimeout(flush, BATCH_WINDOW_MS);
      }
    });
  };
}

export type CardTag = { id: string; name: string; color: string | null };
export type CardAssignee = { id: string; user_id: string; email?: string };

export const fetchTaskTags = createBatcher<CardTag[]>(
  async (ids) => {
    const { data, error } = await supabase
      .from("task_tags")
      .select("task_id, tags(id, name, color)")
      .in("task_id", ids);
    const out: Record<string, CardTag[]> = {};
    if (!error && data) {
      data.forEach((row: any) => {
        if (!row.tags) return;
        (out[row.task_id] ??= []).push(row.tags);
      });
    }
    return out;
  },
  () => [],
);

export const fetchAttachmentCount = createBatcher<number>(
  async (ids) => {
    const { data, error } = await supabase
      .from("task_attachments")
      .select("task_id")
      .in("task_id", ids);
    const out: Record<string, number> = {};
    if (!error && data) {
      data.forEach((row: any) => {
        out[row.task_id] = (out[row.task_id] ?? 0) + 1;
      });
    }
    return out;
  },
  () => 0,
);

export const fetchCommentCount = createBatcher<number>(
  async (ids) => {
    const { data, error } = await supabase
      .from("task_comments")
      .select("task_id")
      .in("task_id", ids);
    const out: Record<string, number> = {};
    if (!error && data) {
      data.forEach((row: any) => {
        out[row.task_id] = (out[row.task_id] ?? 0) + 1;
      });
    }
    return out;
  },
  () => 0,
);

export const fetchTaskAssignees = createBatcher<CardAssignee[]>(
  async (ids) => {
    const { data, error } = await supabase
      .from("task_assignees")
      .select("id, user_id, task_id, profiles(email)")
      .in("task_id", ids);
    const out: Record<string, CardAssignee[]> = {};
    if (!error && data) {
      data.forEach((row: any) => {
        (out[row.task_id] ??= []).push({
          id: row.id,
          user_id: row.user_id,
          email: row.profiles?.email,
        });
      });
    }
    return out;
  },
  () => [],
);

// Per-user caches: previously every TaskCard re-issued these identical queries.
let allTagsCache: { userId: string; promise: Promise<CardTag[]> } | null = null;
let boardsCache: { userId: string; promise: Promise<any[]> } | null = null;

export async function fetchAllTagsForUser(userId: string): Promise<CardTag[]> {
  if (allTagsCache && allTagsCache.userId === userId) return allTagsCache.promise;
  const promise = supabase
    .from("tags")
    .select("*")
    .eq("user_id", userId)
    .order("name")
    .then(({ data, error }) => (!error && data ? (data as CardTag[]) : []));
  allTagsCache = { userId, promise };
  return promise;
}

export async function fetchBoardsForUser(userId: string): Promise<any[]> {
  if (boardsCache && boardsCache.userId === userId) return boardsCache.promise;
  const promise = supabase
    .from("boards")
    .select("*")
    .eq("user_id", userId)
    .order("position", { ascending: true })
    .then(({ data, error }) => (!error && data ? data : []));
  boardsCache = { userId, promise };
  return promise;
}

export function invalidateAllTagsCache() {
  allTagsCache = null;
}
export function invalidateBoardsCache() {
  boardsCache = null;
}