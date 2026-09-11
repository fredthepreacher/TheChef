import type {
  CateringEvent,
  EventDocument,
  EventMenu,
  EventTask,
} from "@/lib/crm/domain";

export type ReadinessState = "ready" | "attention" | "blocked" | "neutral";
export type ReadinessIndicator = {
  key: string;
  label: string;
  state: ReadinessState;
  detail: string;
  included: boolean;
};
export type EventReadiness = {
  percentage: number;
  status: "ready" | "needs_attention" | "blocked";
  indicators: ReadinessIndicator[];
  blockers: string[];
};

type ReadinessEvent = Pick<
  CateringEvent,
  | "venue_id"
  | "venue_snapshot"
  | "guest_count"
  | "guest_count_confirmed_at"
  | "coi_status"
  | "coi_due_at"
  | "client_confirmed_at"
>;

export function calculateReadiness(
  event: ReadinessEvent,
  menu: Pick<EventMenu, "status"> | null,
  tasks: Array<Pick<EventTask, "required" | "status" | "due_at" | "title">>,
  documents: Array<Pick<EventDocument, "category" | "state">>,
  now = new Date(),
): EventReadiness {
  const venueName = String(event.venue_snapshot?.name ?? "").trim();
  const venueAddress = String(event.venue_snapshot?.address ?? "").trim();
  const venueReady = Boolean(event.venue_id && venueName && venueAddress);
  const indicators: ReadinessIndicator[] = [
    {
      key: "venue",
      label: "Venue",
      state: venueReady ? "ready" : "attention",
      detail: venueReady
        ? `${venueName} · address captured`
        : "Venue and complete address needed",
      included: true,
    },
    {
      key: "guest_count",
      label: "Guest count",
      state: event.guest_count_confirmed_at ? "ready" : "attention",
      detail: event.guest_count_confirmed_at
        ? `${event.guest_count} confirmed`
        : `${event.guest_count} recorded · confirmation needed`,
      included: true,
    },
  ];

  const menuReady = menu?.status === "approved" || menu?.status === "locked";
  indicators.push({
    key: "menu",
    label: "Menu",
    state:
      menu?.status === "revision_requested"
        ? "blocked"
        : menuReady
          ? "ready"
          : "attention",
    detail: menu
      ? `Menu ${menu.status.replaceAll("_", " ")}`
      : "Menu setup needed",
    included: true,
  });

  const coiRequired = ![
    "not_required",
    "requirement_unknown",
  ].includes(event.coi_status);
  const coiOverdue =
    coiRequired &&
    event.coi_status !== "approved" &&
    Boolean(event.coi_due_at) &&
    new Date(event.coi_due_at!).getTime() < now.getTime();
  const coiRejected = event.coi_status === "rejected_needs_revision";
  const coiReady =
    event.coi_status === "not_required" || event.coi_status === "approved";
  indicators.push({
    key: "coi",
    label: "COI",
    state:
      coiOverdue || coiRejected
        ? "blocked"
        : coiReady
          ? "ready"
          : "attention",
    detail:
      event.coi_status === "requirement_unknown"
        ? "Requirement must be confirmed"
        : coiOverdue
          ? "Requirement is overdue"
          : event.coi_status.replaceAll("_", " "),
    included: true,
  });

  const activeCoi = documents.some(
    (document) => document.category === "coi" && document.state === "active",
  );
  indicators.push({
    key: "documents",
    label: "Documents",
    state: coiRequired ? (activeCoi ? "ready" : "blocked") : "neutral",
    detail: coiRequired
      ? activeCoi
        ? "Current COI document on file"
        : "Required COI document missing"
      : "No required document established",
    included: coiRequired,
  });

  const requiredTasks = tasks.filter((task) => task.required);
  const completeTasks = requiredTasks.filter(
    (task) => task.status === "complete",
  );
  const blockedTasks = requiredTasks.filter(
    (task) =>
      task.status === "blocked" ||
      (task.status !== "complete" &&
        task.due_at !== null &&
        new Date(task.due_at).getTime() < now.getTime()),
  );
  indicators.push({
    key: "tasks",
    label: "Preparation tasks",
    state:
      blockedTasks.length > 0
        ? "blocked"
        : requiredTasks.length > 0 &&
            completeTasks.length === requiredTasks.length
          ? "ready"
          : "attention",
    detail: requiredTasks.length
      ? `${completeTasks.length} / ${requiredTasks.length} required complete`
      : "Required checklist has not been created",
    included: true,
  });

  indicators.push(
    {
      key: "client_confirmation",
      label: "Client confirmation",
      state: event.client_confirmed_at ? "ready" : "attention",
      detail: event.client_confirmed_at
        ? "Final details confirmed"
        : "Final confirmation needed",
      included: true,
    },
    {
      key: "payment",
      label: "Deposit / payment",
      state: "neutral",
      detail: "Not tracked in Phase 2",
      included: false,
    },
  );

  const scored = indicators.filter((indicator) => indicator.included);
  const complete = scored.filter(
    (indicator) => indicator.state === "ready",
  ).length;
  const blockers = [
    ...indicators
      .filter((indicator) => indicator.state === "blocked")
      .map((indicator) => `${indicator.label}: ${indicator.detail}`),
    ...blockedTasks.map((task) => `Task: ${task.title}`),
  ];
  return {
    percentage: scored.length
      ? Math.round((complete / scored.length) * 100)
      : 0,
    status:
      blockers.length > 0
        ? "blocked"
        : complete === scored.length
          ? "ready"
          : "needs_attention",
    indicators,
    blockers: [...new Set(blockers)],
  };
}
