import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireOperator } from "@/lib/auth/require-operator";
import {
  type CateringEvent,
  coiStatuses,
  type EventDocument,
  type EventMenu,
  type EventTask,
  label,
  menuStatuses,
  taskCategories,
  taskPriorities,
  taskStatuses,
  type Venue,
} from "@/lib/crm/domain";
import { calculateReadiness } from "@/lib/crm/readiness";
import {
  createMenuRevision,
  saveTask,
  setEventConfirmation,
  updateEvent,
  updateEventMenu,
  updateEventOperations,
} from "@/app/crm/actions";
import { Activity, Notice } from "@/components/crm/Shared";
import { EventReadiness } from "@/components/crm/EventReadiness";
import { DocumentManager } from "@/components/crm/DocumentManager";

const easternInput = (value: string | null) =>
  value ? value.slice(0, 16) : "";

export default async function EventDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const { db } = await requireOperator();
  const eventResult = await db
    .from("events")
    .select("*,clients(*)")
    .eq("id", id)
    .maybeSingle();
  if (eventResult.error) throw new Error("Could not load event");
  if (!eventResult.data) notFound();
  const event = eventResult.data as CateringEvent;
  const [venuesResult, menuResult, historyResult, tasksResult, docsResult] =
    await Promise.all([
      db.from("venues").select("*").order("name"),
      event.current_menu_id
        ? db
            .from("event_menus")
            .select("*")
            .eq("id", event.current_menu_id)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      db
        .from("event_menus")
        .select("*")
        .eq("event_id", id)
        .order("version", { ascending: false }),
      db
        .from("tasks")
        .select("*")
        .eq("event_id", id)
        .order("due_at", { ascending: true }),
      db
        .from("event_documents")
        .select("*")
        .eq("event_id", id)
        .order("created_at", { ascending: false }),
    ]);
  if (
    venuesResult.error ||
    menuResult.error ||
    historyResult.error ||
    tasksResult.error ||
    docsResult.error
  )
    throw new Error("Could not load event operations");
  const venues = venuesResult.data as Venue[];
  const menu = menuResult.data as EventMenu | null;
  const menuHistory = historyResult.data as EventMenu[];
  const tasks = tasksResult.data as EventTask[];
  const documents = docsResult.data as EventDocument[];
  const readiness = calculateReadiness(event, menu, tasks, documents);

  return (
    <>
      <Link href="/crm/events">← Catering events</Link>
      <p className="crm-eyebrow">Event operations</p>
      <h1>{event.event_type}</h1>
      <Notice {...(await searchParams)} />
      <p>
        <Link href={`/crm/clients/${event.client_id}`}>
          {event.clients.first_name} {event.clients.last_name}
        </Link>{" "}
        · <Link href={`/crm/leads/${event.lead_id}`}>Original inquiry</Link>
      </p>
      <nav className="crm-anchor-nav" aria-label="Event workspace">
        <a href="#overview">Overview</a>
        <a href="#venue-coi">Venue & COI</a>
        <a href="#menu">Menu</a>
        <a href="#tasks">Tasks</a>
        <a href="#documents">Documents</a>
        <a href="#activity">Activity</a>
      </nav>

      <EventReadiness readiness={readiness} />

      <div className="crm-columns" id="overview">
        <section className="crm-panel">
          <h2>Event overview</h2>
          <form action={updateEvent}>
            <input type="hidden" name="id" value={id} />
            <label>
              Event date
              <input
                type="date"
                name="event_date"
                defaultValue={event.event_date}
                required
              />
            </label>
            <label>
              Guest count
              <input
                type="number"
                name="guest_count"
                min="1"
                max="10000"
                defaultValue={event.guest_count}
                required
              />
            </label>
            <label>
              Event status
              <select name="status" defaultValue={event.status}>
                {[
                  "prospective",
                  "booked",
                  "pre_event",
                  "completed",
                  "cancelled",
                  "archived",
                ].map((status) => (
                  <option value={status} key={status}>
                    {label(status)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Internal notes
              <textarea
                name="internal_notes"
                maxLength={4000}
                defaultValue={event.internal_notes}
              />
            </label>
            <button>Save event</button>
          </form>
        </section>
        <section className="crm-panel">
          <h2>Confirmations</h2>
          <p>
            Guest count:{" "}
            <strong>
              {event.guest_count_confirmed_at
                ? "Confirmed"
                : "Needs confirmation"}
            </strong>
          </p>
          <form action={setEventConfirmation}>
            <input type="hidden" name="id" value={id} />
            <input
              type="hidden"
              name="field"
              value="guest_count_confirmed_at"
            />
            <input
              type="hidden"
              name="confirmed"
              value={String(!event.guest_count_confirmed_at)}
            />
            <button className="crm-secondary">
              {event.guest_count_confirmed_at
                ? "Mark guest count unconfirmed"
                : "Confirm guest count"}
            </button>
          </form>
          <p>
            Client:{" "}
            <strong>
              {event.client_confirmed_at ? "Confirmed" : "Needs confirmation"}
            </strong>
          </p>
          <form action={setEventConfirmation}>
            <input type="hidden" name="id" value={id} />
            <input
              type="hidden"
              name="field"
              value="client_confirmed_at"
            />
            <input
              type="hidden"
              name="confirmed"
              value={String(!event.client_confirmed_at)}
            />
            <button className="crm-secondary">
              {event.client_confirmed_at
                ? "Mark client unconfirmed"
                : "Confirm final details"}
            </button>
          </form>
          <h3>Deposit / payment</h3>
          <p className="crm-muted">
            Not tracked in Phase 2 and excluded from readiness.
          </p>
        </section>
      </div>

      <section className="crm-panel" id="venue-coi">
        <p className="crm-eyebrow">Location and compliance</p>
        <h2>Venue & COI</h2>
        <form action={updateEventOperations}>
          <input type="hidden" name="id" value={id} />
          <div className="crm-form-grid">
            <label>
              Saved venue
              <select name="venue_id" defaultValue={event.venue_id ?? ""}>
                <option value="">Venue not linked</option>
                {venues.map((venue) => (
                  <option value={venue.id} key={venue.id}>
                    {venue.name} · {venue.city || "city needed"}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Service style
              <input name="service_style" defaultValue={event.service_style} />
            </label>
            <label>
              Start time
              <input
                type="time"
                name="start_time"
                defaultValue={event.start_time?.slice(0, 5) ?? ""}
              />
            </label>
            <label>
              End time
              <input
                type="time"
                name="end_time"
                defaultValue={event.end_time?.slice(0, 5) ?? ""}
              />
            </label>
            <label>
              COI status
              <select name="coi_status" defaultValue={event.coi_status}>
                {coiStatuses.map((status) => (
                  <option value={status} key={status}>
                    {label(status)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              COI due date and time
              <input
                type="datetime-local"
                name="coi_due_at"
                defaultValue={easternInput(event.coi_due_at)}
              />
            </label>
          </div>
          <label>
            Venue requirements
            <textarea
              name="venue_requirements"
              defaultValue={event.venue_requirements}
            />
          </label>
          <label>
            Additional insured information
            <textarea
              name="additional_insured_information"
              defaultValue={event.additional_insured_information}
            />
          </label>
          <label>
            Internal COI notes
            <textarea
              name="coi_internal_notes"
              defaultValue={event.coi_internal_notes}
            />
          </label>
          <button>Save venue & COI</button>
        </form>
        <p className="crm-muted">
          COI approval is always a human decision. Uploading a document does not
          approve it.
        </p>
      </section>

      <section className="crm-panel" id="menu">
        <div className="crm-section-heading">
          <div>
            <p className="crm-eyebrow">Working event menu</p>
            <h2>
              {menu ? `Revision ${menu.version} · ${label(menu.status)}` : "Menu setup"}
            </h2>
          </div>
          {menu?.status === "locked" && (
            <form action={createMenuRevision}>
              <input type="hidden" name="event_id" value={id} />
              <input type="hidden" name="menu_id" value={menu.id} />
              <button>Create revision</button>
            </form>
          )}
        </div>
        {menu && (
          <form action={updateEventMenu}>
            <input type="hidden" name="id" value={menu.id} />
            <input type="hidden" name="event_id" value={id} />
            <label>
              Menu status
              <select
                name="status"
                defaultValue={menu.status}
                disabled={menu.status === "locked"}
              >
                {menuStatuses.map((status) => (
                  <option value={status} key={status}>
                    {label(status)}
                  </option>
                ))}
              </select>
            </label>
            <div className="crm-form-grid">
              {[
                ["package_details", "Package / custom details"],
                ["appetizers", "Appetizers"],
                ["entrees", "Entrées"],
                ["seafood", "Seafood"],
                ["sides", "Sides"],
                ["desserts", "Desserts"],
                ["bread", "Bread"],
                ["dietary_accommodations", "Dietary accommodations"],
                ["allergy_notes", "Allergies"],
                ["substitutions", "Substitutions"],
                ["custom_menu_notes", "Special requests"],
                ["internal_prep_notes", "Internal preparation notes"],
              ].map(([name, title]) => (
                <label key={name}>
                  {title}
                  <textarea
                    name={name}
                    defaultValue={String(menu[name as keyof EventMenu] ?? "")}
                    disabled={menu.status === "locked"}
                  />
                </label>
              ))}
            </div>
            {menu.status !== "locked" && <button>Save working menu</button>}
          </form>
        )}
        <details>
          <summary>Menu revision history ({menuHistory.length})</summary>
          {menuHistory.map((revision) => (
            <p key={revision.id}>
              Revision {revision.version} · {label(revision.status)} ·{" "}
              {new Date(revision.updated_at).toLocaleString()}
            </p>
          ))}
        </details>
        <details>
          <summary>Original inquiry snapshots</summary>
          <h3>Package at inquiry</h3>
          <pre className="crm-snapshot">
            {JSON.stringify(event.package_snapshot, null, 2)}
          </pre>
          <h3>Requested menu at inquiry</h3>
          <pre className="crm-snapshot">
            {JSON.stringify(event.menu_snapshot, null, 2)}
          </pre>
        </details>
      </section>

      <section className="crm-panel" id="tasks">
        <p className="crm-eyebrow">Preparation checklist</p>
        <h2>Tasks</h2>
        {tasks.map((task) => (
          <form className="crm-task" action={saveTask} key={task.id}>
            <input type="hidden" name="id" value={task.id} />
            <input type="hidden" name="event_id" value={id} />
            <input type="hidden" name="title" value={task.title} />
            <input type="hidden" name="description" value={task.description} />
            <input type="hidden" name="category" value={task.category} />
            <input
              type="hidden"
              name="assignee_id"
              value={task.assignee_id ?? ""}
            />
            <input
              type="hidden"
              name="due_at"
              value={task.due_at ? task.due_at.slice(0, 16) : ""}
            />
            <input type="hidden" name="priority" value={task.priority} />
            <input type="hidden" name="required" value={String(task.required)} />
            <input type="hidden" name="notes" value={task.notes} />
            <span>
              <strong>{task.title}</strong>
              <small>
                {label(task.category)} · {label(task.priority)}
                {task.due_at
                  ? ` · Due ${new Date(task.due_at).toLocaleString()}`
                  : ""}
              </small>
            </span>
            <select name="status" defaultValue={task.status}>
              {taskStatuses.map((status) => (
                <option value={status} key={status}>
                  {label(status)}
                </option>
              ))}
            </select>
            <button className="crm-secondary">Update</button>
          </form>
        ))}
        <details>
          <summary>Add custom task</summary>
          <form action={saveTask}>
            <input type="hidden" name="id" value="" />
            <input type="hidden" name="event_id" value={id} />
            <div className="crm-form-grid">
              <label>
                Title
                <input name="title" required />
              </label>
              <label>
                Category
                <select name="category" defaultValue="administrative">
                  {taskCategories.map((category) => (
                    <option value={category} key={category}>
                      {label(category)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Status
                <select name="status" defaultValue="todo">
                  {taskStatuses.map((status) => (
                    <option value={status} key={status}>
                      {label(status)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Priority
                <select name="priority" defaultValue="normal">
                  {taskPriorities.map((priority) => (
                    <option value={priority} key={priority}>
                      {label(priority)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Due
                <input type="datetime-local" name="due_at" />
              </label>
              <label>
                Required for readiness
                <select name="required" defaultValue="true">
                  <option value="true">Required</option>
                  <option value="false">Optional</option>
                </select>
              </label>
            </div>
            <label>
              Description
              <textarea name="description" />
            </label>
            <label>
              Notes
              <textarea name="notes" />
            </label>
            <input type="hidden" name="assignee_id" value="" />
            <button>Add task</button>
          </form>
        </details>
      </section>

      <DocumentManager
        eventId={id}
        clientId={event.client_id}
        documents={documents}
      />

      <div id="activity">
        <Activity
          id={id}
          relatedIds={[
            ...tasks.map((task) => task.id),
            ...menuHistory.map((revision) => revision.id),
            ...documents.map((document) => document.id),
          ]}
        />
      </div>
    </>
  );
}
