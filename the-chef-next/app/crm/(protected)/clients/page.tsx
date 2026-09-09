import Link from "next/link";
import { requireOperator } from "@/lib/auth/require-operator";
import { Search, Empty, Notice } from "@/components/crm/Shared";
import type { Client } from "@/lib/crm/domain";
export default async function Clients({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; error?: string }>;
}) {
  const p = await searchParams;
  const { db } = await requireOperator();
  const { data, error } = await db
    .from("clients")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw new Error("Could not load clients");
  const clients = (data as Client[]).filter((c) =>
    `${c.first_name} ${c.last_name} ${c.email}`
      .toLowerCase()
      .includes((p.q ?? "").toLowerCase()),
  );
  return (
    <>
      <p className="crm-eyebrow">Relationships around the table</p>
      <h1>Clients</h1>
      <Notice error={p.error} />
      <Search value={p.q} />
      <div className="crm-grid">
        {clients.map((c) => (
          <Link
            className="crm-panel crm-record"
            key={c.id}
            href={`/crm/clients/${c.id}`}
          >
            <h2>
              {c.first_name} {c.last_name}
            </h2>
            <p>{c.email}</p>
            <p>{c.phone}</p>
            {c.archived && <span className="crm-chip">Archived</span>}
          </Link>
        ))}
      </div>
      {!clients.length && (
        <Empty>
          No matching clients. A saved inquiry creates or matches a client
          automatically.
        </Empty>
      )}
      <p className="crm-muted">Showing up to 200 most recent records.</p>
    </>
  );
}
