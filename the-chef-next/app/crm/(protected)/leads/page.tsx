import Link from "next/link";
import { requireOperator } from "@/lib/auth/require-operator";
import { stages, label, type Lead } from "@/lib/crm/domain";
import { Empty, Search, Notice } from "@/components/crm/Shared";
export default async function Leads({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    status?: string;
    view?: string;
    error?: string;
  }>;
}) {
  const p = await searchParams;
  const { db } = await requireOperator();
  let query = db
    .from("leads")
    .select("*,clients(*)")
    .order("created_at", { ascending: false })
    .limit(200);
  if (p.status && stages.includes(p.status as Lead["status"]))
    query = query.eq("status", p.status);
  const { data, error } = await query;
  if (error) throw new Error("Could not load leads");
  const leads = (data as Lead[]).filter((l) =>
    `${l.clients.first_name} ${l.clients.last_name} ${l.clients.email} ${l.event_type}`
      .toLowerCase()
      .includes((p.q ?? "").toLowerCase()),
  );
  const card = (l: Lead) => (
    <Link
      className="crm-panel crm-record"
      href={`/crm/leads/${l.id}`}
      key={l.id}
    >
      <h3>
        {l.clients.first_name} {l.clients.last_name}
      </h3>
      <p>
        {l.event_type} · {l.requested_date}
      </p>
      <p>
        {l.guest_count} guests · {l.package_interest}
      </p>
      <span className="crm-chip">{label(l.status)}</span>
    </Link>
  );
  return (
    <>
      <p className="crm-eyebrow">From first hello to booked event</p>
      <h1>Lead pipeline</h1>
      <Notice error={p.error} />
      <Search value={p.q} />
      <div className="crm-links">
        <Link href="?view=list">List view</Link>
        <Link href="?view=board">Board view</Link>
      </div>
      <form className="crm-search">
        <label>
          Status
          <select name="status" defaultValue={p.status ?? ""}>
            <option value="">All stages</option>
            {stages.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
        <button>Filter</button>
      </form>
      {!leads.length ? (
        <Empty>No matching leads. Catering inquiries will appear here.</Empty>
      ) : p.view === "board" ? (
        <div className="crm-board">
          {stages.map((s) => (
            <section key={s}>
              <h2>{label(s)}</h2>
              {leads.filter((l) => l.status === s).map(card)}
            </section>
          ))}
        </div>
      ) : (
        <div className="crm-grid">{leads.map(card)}</div>
      )}
      <p className="crm-muted">
        Showing up to 200 most recent records. Open a lead to update its stage.
      </p>
    </>
  );
}
