import Link from "next/link";
import { requireOperator } from "@/lib/auth/require-operator";
import { VenueForm } from "@/components/crm/VenueForm";
import { Empty, Notice, Search } from "@/components/crm/Shared";
import type { Venue } from "@/lib/crm/domain";

export default async function Venues({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; error?: string }>;
}) {
  const params = await searchParams;
  const { db } = await requireOperator();
  const { data, error } = await db.from("venues").select("*").order("name");
  if (error) throw new Error("Could not load venues");
  const query = (params.q ?? "").toLowerCase();
  const venues = (data as Venue[]).filter((venue) =>
    `${venue.name} ${venue.address} ${venue.city} ${venue.contact_name}`
      .toLowerCase()
      .includes(query),
  );
  return (
    <>
      <p className="crm-eyebrow">Reusable event locations</p>
      <h1>Venues</h1>
      <Notice error={params.error} />
      <Search value={params.q} />
      <div className="crm-columns">
        <section>
          <h2>Saved venues</h2>
          {venues.map((venue) => (
            <Link
              className="crm-panel crm-record"
              href={`/crm/venues/${venue.id}`}
              key={venue.id}
            >
              <h3>{venue.name}</h3>
              <p>
                {[venue.address, venue.city, venue.state, venue.postal_code]
                  .filter(Boolean)
                  .join(", ") || "Address needs attention"}
              </p>
              <small>COI: {venue.coi_requirement.replaceAll("_", " ")}</small>
            </Link>
          ))}
          {!venues.length && <Empty>No matching venues.</Empty>}
        </section>
        <section className="crm-panel">
          <h2>Add a venue</h2>
          <VenueForm />
        </section>
      </div>
    </>
  );
}
