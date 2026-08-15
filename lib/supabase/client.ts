'use client';
import { createBrowserClient } from '@supabase/ssr';

/** Browser client. Only ever sees the anon key; RLS does the rest. */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
