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

export default async function Dashboard() {
  const { db } = await requireOperator();
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const sixtyDays = new Date(now.getTime() + 60 * 86400000)
    .toISOString()
    .slice(0, 10);
  const [newLeads, clients, eventsResult, overdueResult, menuResult] =
    await Promise.all([
      db
        .from("leads")
        .select("id,event_type,requested_date,created_at,clients(first_name,last_name)")
        .eq("status", "new_inquiry")
        .order("created_at")
        .limit(10),
      db
        .from("clients")
        .select("id", { count: "exact", head: true })
        .eq("archived", false),
      db
        .from("events")
        .select("*,clients(*)")
        .gte("event_date", today)
        .lte("event_date", sixtyDays)
        .in("status", ["booked", "pre_event"])
        .order("event_date")
        .limit(20),
      db
        .from("tasks")
        .select("id,title,event_id,due_at,status,priority,events(event_type)")
        .neq("status", "complete")
        .lt("due_at", now.toISOString())
        .order("due_at")
        .limit(12),
      db
        .from("event_menus")
        .select("id,event_id,status")
        .in("status", ["client_review", "revision_requested"])
        .limit(12),
    ]);
  if (
    newLeads.error ||
    clients.error ||
    eventsResult.error ||
    overdueResult.error ||
    menuResult.error
  )
    throw new Error("Dashboard could not load");
  const events = eventsResult.data as CateringEvent[];
  const ids = events.map((event) => event.id);
  const menuIds = events
    .map((event) => event.current_menu_id)
    .filter((id): id is string => Boolean(id));
  const empty = Promise.resolve({ data: [], error: null });
  const [tasksResult, docsResult, currentMenusResult] = await Promise.all([
    ids.length ? db.from("tasks").select("*").in("event_id", ids) : empty,
    ids.length
      ? db.from("event_documents").select("*").in("event_id", ids)
      : empty,
    menuIds.length
      ? db.from("event_menus").select("*").in("id", menuIds)
      : empty,
  ]);
  if (tasksResult.error || docsResult.error || currentMenusResult.error)
    throw new Error("Dashboard readiness could not load");
  const tasks = tasksResult.data as EventTask[];
  const documents = docsResult.data as EventDocument[];
  const menus = currentMenusResult.data as EventMenu[];
  const priorities = events.map((event) => ({
    event,
    readiness: calculateReadiness(
      event,
      menus.find((menu) => menu.id === event.current_menu_id) ?? null,
      tasks.filter((task) => task.event_id === event.id),
      documents.filter((document) => document.event_id === event.id),
    ),
  }));
  const blocked = priorities.filter(
    (item) => item.readiness.status !== "ready",
  );
  const coiAttention = events.filter(
    (event) =>
      !["not_required", "approved"].includes(event.coi_status),
  ).length;

  return (
    <>
      <p className="crm-eyebrow">What needs attention today?</p>
      <h1>Catering operations.</h1>
      <div className="crm-kpis">
        {[
          ["New inquiries", newLeads.data?.length ?? 0],
          ["Upcoming events", events.length],
          ["Readiness attention", blocked.length],
          ["COI attention", coiAttention],
          ["Overdue tasks", overdueResult.data?.length ?? 0],
          ["Menus in review", menuResult.data?.length ?? 0],
          ["Active clients", clients.count ?? 0],
        ].map(([title, value]) => (
          <div className="crm-panel" key={title}>
            <p>{title}</p>
            <strong>{value}</strong>
          </div>
        ))}
      </div>
      <div className="crm-columns">
        <section>
          <h2>Readiness blockers</h2>
          {blocked.slice(0, 8).map(({ event, readiness }) => (
            <Link
              className="crm-panel crm-record"
              href={`/crm/events/${event.id}`}
              key={event.id}
            >
              <h3>{event.event_type}</h3>
              <p>
                {event.event_date} · {event.clients.first_name}{" "}
                {event.clients.last_name}
              </p>
              <span
                className={`crm-state crm-state-${readiness.status === "blocked" ? "blocked" : "attention"}`}
              >
                {readiness.percentage}% · {label(readiness.status)}
              </span>
              <small>
                {readiness.blockers[0] ??
                  readiness.indicators.find(
                    (indicator) => indicator.state === "attention",
                  )?.detail}
              </small>
            </Link>
          ))}
          {!blocked.length && <Empty>No upcoming event blockers.</Empty>}
        </section>
        <section>
          <h2>New inquiries</h2>
          {newLeads.data?.map((lead) => {
            const client = lead.clients as unknown as {
              first_name: string;
              last_name: string;
            };
            return (
              <Link
                className="crm-panel crm-record"
                href={`/crm/leads/${lead.id}`}
                key={lead.id}
              >
                <h3>{lead.event_type}</h3>
                <p>
                  {client.first_name} {client.last_name} · {lead.requested_date}
                </p>
                <small>
                  Received {new Date(lead.created_at).toLocaleString()}
                </small>
              </Link>
            );
          })}
          {!newLeads.data?.length && (
            <Empty>No new inquiries awaiting a response.</Empty>
          )}
        </section>
      </div>
      <div className="crm-columns">
        <section className="crm-panel">
          <h2>Overdue preparation</h2>
          {overdueResult.data?.map((task) => (
            <p key={task.id}>
              <Link href={task.event_id ? `/crm/events/${task.event_id}#tasks` : "/crm/tasks"}>
                {task.title}
              </Link>{" "}
              · {task.due_at ? new Date(task.due_at).toLocaleString() : ""}
            </p>
          ))}
          {!overdueResult.data?.length && <p>No overdue tasks.</p>}
        </section>
        <section className="crm-panel">
          <h2>Upcoming deadlines</h2>
          {priorities.slice(0, 8).map(({ event, readiness }) => (
            <p key={event.id}>
              <Link href={`/crm/events/${event.id}`}>
                {event.event_date} · {event.event_type}
              </Link>{" "}
              · {readiness.percentage}% ready
            </p>
          ))}
          {!priorities.length && <p>No upcoming booked events.</p>}
        </section>
      </div>
    </>
  );
}
