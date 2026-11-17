import Link from "next/link";
import { requireOperator } from "@/lib/auth/require-operator";
import {
  type CateringEvent,
  type EventDocument,
  type EventMenu,
  type EventTask,
  label,
} from "@/lib/crm/domain";
import { calculateReadiness } from "@/lib/crm/readiness";
import { Empty } from "@/components/crm/Shared";

const monthPattern = /^\d{4}-(0[1-9]|1[0-2])$/;
const shiftMonth = (month: string, amount: number) => {
  const [year, number] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year, number - 1 + amount, 1));
  return date.toISOString().slice(0, 7);
};

export default async function Calendar({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; view?: string }>;
}) {
  const params = await searchParams;
  const current = new Date().toISOString().slice(0, 7);
  const month = monthPattern.test(params.month ?? "") ? params.month! : current;
  const view = params.view === "agenda" ? "agenda" : "calendar";
  const start = `${month}-01`;
  const end = `${shiftMonth(month, 1)}-01`;
  const { db } = await requireOperator();
  const { data, error } = await db
    .from("events")
    .select("*,clients(*)")
    .gte("event_date", start)
    .lt("event_date", end)
    .order("event_date")
    .order("start_time");
  if (error) throw new Error("Could not load calendar");
  const events = data as CateringEvent[];
  const ids = events.map((event) => event.id);
  const menuIds = events
    .map((event) => event.current_menu_id)
    .filter((id): id is string => Boolean(id));
  const empty = Promise.resolve({ data: [], error: null });
  const [tasksResult, docsResult, menusResult] = await Promise.all([
    ids.length
      ? db.from("tasks").select("*").in("event_id", ids)
      : empty,
    ids.length
      ? db.from("event_documents").select("*").in("event_id", ids)
      : empty,
    menuIds.length
      ? db.from("event_menus").select("*").in("id", menuIds)
      : empty,
  ]);
  if (tasksResult.error || docsResult.error || menusResult.error)
    throw new Error("Could not load calendar readiness");
  const tasks = tasksResult.data as EventTask[];
  const documents = docsResult.data as EventDocument[];
  const menus = menusResult.data as EventMenu[];
  const readiness = new Map(
    events.map((event) => [
      event.id,
      calculateReadiness(
        event,
        menus.find((menu) => menu.id === event.current_menu_id) ?? null,
        tasks.filter((task) => task.event_id === event.id),
        documents.filter((document) => document.event_id === event.id),
      ),
    ]),
  );
  const monthDate = new Date(`${month}-01T12:00:00Z`);
  const offset = monthDate.getUTCDay();
  const gridStart = new Date(monthDate);
  gridStart.setUTCDate(1 - offset);
  const days = Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart);
    date.setUTCDate(gridStart.getUTCDate() + index);
    return date.toISOString().slice(0, 10);
  });

  return (
    <>
      <p className="crm-eyebrow">Catering schedule</p>
      <h1>
        {monthDate.toLocaleDateString("en-US", {
          month: "long",
          year: "numeric",
          timeZone: "UTC",
        })}
      </h1>
      <nav className="crm-calendar-nav">
        <Link href={`?month=${shiftMonth(month, -1)}&view=${view}`}>
          ← Previous
        </Link>
        <Link href={`?month=${current}&view=${view}`}>Current month</Link>
        <Link href={`?month=${shiftMonth(month, 1)}&view=${view}`}>
          Next →
        </Link>
        <span />
        <Link href={`?month=${month}&view=calendar`}>Calendar</Link>
        <Link href={`?month=${month}&view=agenda`}>Agenda</Link>
      </nav>
      {view === "calendar" ? (
        <div className="crm-calendar">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
            <strong className="crm-calendar-label" key={day}>
              {day}
            </strong>
          ))}
          {days.map((day) => (
            <section
              className={`crm-calendar-day ${day.startsWith(month) ? "" : "crm-calendar-outside"}`}
              key={day}
            >
              <time>{Number(day.slice(-2))}</time>
              {events
                .filter((event) => event.event_date === day)
                .map((event) => (
                  <Link
                    href={`/crm/events/${event.id}`}
                    className={`crm-calendar-event crm-state-${readiness.get(event.id)!.status === "needs_attention" ? "attention" : readiness.get(event.id)!.status}`}
                    key={event.id}
                  >
                    {event.start_time?.slice(0, 5)} {event.event_type}
                  </Link>
                ))}
            </section>
          ))}
        </div>
      ) : (
        <div className="crm-agenda">
          {events.map((event) => {
            const venue = String(event.venue_snapshot?.name ?? "Venue needed");
            const status = readiness.get(event.id)!;
            return (
              <Link
                className="crm-panel crm-record crm-agenda-row"
                href={`/crm/events/${event.id}`}
                key={event.id}
              >
                <time>{event.event_date}</time>
                <span>
                  <strong>{event.event_type}</strong>
                  <small>
                    {event.clients.first_name} {event.clients.last_name} ·{" "}
                    {venue} · {event.guest_count} guests · {label(event.status)}
                  </small>
                </span>
                <span className={`crm-state crm-state-${status.status === "needs_attention" ? "attention" : status.status}`}>
                  {status.percentage}% · {label(status.status)}
                </span>
              </Link>
            );
          })}
          {!events.length && <Empty>No catering events this month.</Empty>}
        </div>
      )}
    </>
  );
}
