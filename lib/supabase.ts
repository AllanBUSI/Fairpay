import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // Pour créer des buckets

if (!supabaseUrl) {
  throw new Error(
    "Missing NEXT_PUBLIC_SUPABASE_URL environment variable. " +
    "Please add it to your .env file: NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co"
  );
}

if (!supabaseAnonKey) {
  throw new Error(
    "Missing NEXT_PUBLIC_SUPABASE_ANON_KEY environment variable. " +
    "Please add it to your .env file: NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key"
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Client avec permissions admin pour créer des buckets (optionnel)
export const supabaseAdmin = supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null;

