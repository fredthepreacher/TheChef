import Link from "next/link";
import { requireOperator } from "@/lib/auth/require-operator";
import { saveTask } from "@/app/crm/actions";
import {
  label,
  taskStatuses,
  type EventTask,
} from "@/lib/crm/domain";
import { Empty, Notice } from "@/components/crm/Shared";

type TaskRow = EventTask & {
  events: { event_type: string; event_date: string } | null;
  clients: { first_name: string; last_name: string } | null;
};

export default async function Tasks({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
    error?: string;
    saved?: string;
  }>;
}) {
  const params = await searchParams;
  const { db } = await requireOperator();
  let query = db
    .from("tasks")
    .select("*,events(event_type,event_date),clients(first_name,last_name)")
    .order("due_at", { ascending: true, nullsFirst: false })
    .limit(300);
  if (taskStatuses.includes(params.status as (typeof taskStatuses)[number]))
    query = query.eq("status", params.status!);
  else query = query.neq("status", "complete");
  const { data, error } = await query;
  if (error) throw new Error("Could not load tasks");
  const tasks = data as unknown as TaskRow[];
  return (
    <>
      <p className="crm-eyebrow">Across every catering event</p>
      <h1>Task queue</h1>
      <Notice error={params.error} saved={params.saved} />
      <nav className="crm-links" aria-label="Task filters">
        <Link href="/crm/tasks">Open</Link>
        {taskStatuses.map((status) => (
          <Link href={`/crm/tasks?status=${status}`} key={status}>
            {label(status)}
          </Link>
        ))}
      </nav>
      <section className="crm-panel">
        {tasks.map((task) => {
          const overdue =
            task.status !== "complete" &&
            task.due_at &&
            new Date(task.due_at) < new Date();
          return (
            <form className="crm-task" action={saveTask} key={task.id}>
              <input type="hidden" name="id" value={task.id} />
              <input
                type="hidden"
                name="event_id"
                value={task.event_id ?? ""}
              />
              <input type="hidden" name="title" value={task.title} />
              <input
                type="hidden"
                name="description"
                value={task.description}
              />
              <input type="hidden" name="category" value={task.category} />
              <input
                type="hidden"
                name="assignee_id"
                value={task.assignee_id ?? ""}
              />
              <input
                type="hidden"
                name="due_at"
                value={task.due_at?.slice(0, 16) ?? ""}
              />
              <input type="hidden" name="priority" value={task.priority} />
              <input
                type="hidden"
                name="required"
                value={String(task.required)}
              />
              <input type="hidden" name="notes" value={task.notes} />
              <span>
                <strong>{task.title}</strong>
                <small>
                  {task.clients
                    ? `${task.clients.first_name} ${task.clients.last_name}`
                    : "Client"}{" "}
                  · {task.events?.event_type ?? "Lead follow-up"} ·{" "}
                  {label(task.priority)}
                  {task.due_at
                    ? ` · ${overdue ? "OVERDUE " : "Due "}${new Date(
                        task.due_at,
                      ).toLocaleString()}`
                    : ""}
                </small>
                {task.event_id && (
                  <Link href={`/crm/events/${task.event_id}#tasks`}>
                    Open event
                  </Link>
                )}
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
          );
        })}
        {!tasks.length && <Empty>No tasks in this view.</Empty>}
      </section>
    </>
  );
}
