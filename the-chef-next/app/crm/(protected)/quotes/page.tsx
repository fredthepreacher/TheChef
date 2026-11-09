import Link from "next/link";
import { requireOperator } from "@/lib/auth/require-operator";
import { Empty } from "@/components/crm/Shared";
import { label, money, type Client, type QuoteVersion } from "@/lib/crm/domain";

type QuoteRow = {
  id: string;
  quote_number: number;
  current_version_id: string | null;
  clients: Client;
  quote_versions: QuoteVersion[];
};

export default async function QuotesPage() {
  const { db } = await requireOperator();
  const { data, error } = await db
    .from("quotes")
    .select("id,quote_number,current_version_id,clients(*),quote_versions(*)")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw new Error("Could not load quotes");
  const quotes = (data ?? []) as unknown as QuoteRow[];
  return (
    <>
      <p className="crm-eyebrow">Proposals and pricing</p>
      <h1>Quotes</h1>
      <div className="crm-grid">
        {quotes.map((quote) => {
          const version = quote.quote_versions.find(
            (candidate) => candidate.id === quote.current_version_id,
          );
          return (
            <Link className="crm-panel crm-record" href={`/crm/quotes/${quote.id}`} key={quote.id}>
              <h2>Quote #{quote.quote_number}</h2>
              <p>{quote.clients.first_name} {quote.clients.last_name}</p>
              <p>{version ? money(version.total_cents) : "No active version"}</p>
              {version && <span className="crm-chip">{label(version.status)}</span>}
            </Link>
          );
        })}
      </div>
      {!quotes.length && <Empty>Create a quote from an open lead.</Empty>}
    </>
  );
}
