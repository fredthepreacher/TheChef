import "server-only";
import { createClient } from "@supabase/supabase-js";
// Only public intake uses this privileged client; CRM queries always use the user's RLS session.
export function intakeClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    },
  );
}
