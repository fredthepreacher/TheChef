import Link from "next/link";
import { requireOperator } from "@/lib/auth/require-operator";
import { label } from "@/lib/crm/domain";
import { formatEtDateTime } from "@/lib/crm/time";
export function Notice({ error, saved }: { error?: string; saved?: string }) {
  return error ? (
    <p className="crm-notice" role="alert">
      Could not save. Check required fields and try again. Closed leads cannot
      become events.
    </p>
  ) : saved ? (
    <p className="crm-notice" role="status">
      Changes saved.
    </p>
  ) : null;
}
export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="crm-panel crm-empty">{children}</div>;
}
export function Search({ value = "" }: { value?: string }) {
  return (
    <form className="crm-search">
      <label>
        Search
        <input name="q" defaultValue={value} maxLength={100} />
      </label>
      <button>Search</button>
      <Link href="?">Clear</Link>
    </form>
  );
}
export async function Activity({ id, relatedIds = [] }: { id: string; relatedIds?: string[] }) {
  const { db } = await requireOperator();
  const { data, error } = await db
    .from("activity_log")
    .select("id,action,entity_type,created_at,metadata")
    .in("entity_id", [id, ...relatedIds])
    .order("created_at", { ascending: false })
    .limit(30);
  if (error) throw new Error("Unable to load activity");
  return (
    <section className="crm-panel">
      <h2>Activity</h2>
      {data?.map((a) => (
        <div className="crm-activity" key={a.id}>
          <strong>
            {label(a.action)} · {label(a.entity_type)}
          </strong>
          <time>{formatEtDateTime(a.created_at)}</time>
          {a.metadata?.before?.status !== a.metadata?.after?.status &&
            a.metadata?.after?.status && (
              <p>
                {label(a.metadata.before.status)} →{" "}
                {label(a.metadata.after.status)}
              </p>
            )}
          {a.metadata?.before?.guest_count !== a.metadata?.after?.guest_count &&
            a.metadata?.after?.guest_count && (
              <p>
                Guest count: {a.metadata.before.guest_count} →{" "}
                {a.metadata.after.guest_count}
              </p>
            )}
        </div>
      ))}
      {!data?.length && <p>No activity recorded.</p>}
    </section>
  );
}
