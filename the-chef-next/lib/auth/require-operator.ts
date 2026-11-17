import "server-only";
import { redirect } from "next/navigation";
import { configured, serverClient } from "@/lib/supabase/server";
export async function requireOperator() {
  if (!configured()) redirect("/crm/login");
  const db = await serverClient();
  const {
    data: { user },
    error,
  } = await db.auth.getUser();
  if (error || !user) redirect("/crm/login");
  const { data: profile, error: roleError } = await db
    .from("profiles")
    .select("role,active")
    .eq("id", user.id)
    .single();
  if (
    roleError ||
    !profile?.active ||
    !["owner", "manager"].includes(profile.role)
  )
    redirect("/crm/login?error=access");
  return { db, user, role: profile.role as "owner" | "manager" };
}
