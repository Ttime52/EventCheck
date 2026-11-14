import type { Event as EventRecord } from "@prisma/client";

const eventInputFields = new Set(["title", "description", "location", "startAt", "endAt", "capacity"]);
const offsetDateTimePattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/;

export type EventValidationIssue = { field: string; message: string };

export type ValidatedEventInput = {
  title: string;
  description: string;
  location: string;
  startAt: Date;
  endAt: Date;
  capacity: number;
};

type ValidationResult =
  | { ok: true; value: ValidatedEventInput }
  | { ok: false; issues: EventValidationIssue[] };

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function addTextIssue(issues: EventValidationIssue[], body: Record<string, unknown>, field: "title" | "description" | "location") {
  const value = body[field];
  if (typeof value !== "string" || value.trim().length === 0) issues.push({ field, message: `${field} is required` });
}

function parseInstant(issues: EventValidationIssue[], body: Record<string, unknown>, field: "startAt" | "endAt") {
  const value = body[field];
  if (typeof value !== "string" || !offsetDateTimePattern.test(value)) {
    issues.push({ field, message: `${field} must be an offset-aware ISO 8601 date-time` });
    return undefined;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    issues.push({ field, message: `${field} must be a valid date-time` });
    return undefined;
  }
  return parsed;
}

export function validateCreateEventInput(body: unknown): ValidationResult {
  if (!isRecord(body)) return { ok: false, issues: [{ field: "body", message: "Request body must be a JSON object" }] };

  const issues: EventValidationIssue[] = [];
  for (const field of Object.keys(body)) {
    if (!eventInputFields.has(field)) issues.push({ field, message: `${field} is not accepted` });
  }
  addTextIssue(issues, body, "title");
  addTextIssue(issues, body, "description");
  addTextIssue(issues, body, "location");

  const startAt = parseInstant(issues, body, "startAt");
  const endAt = parseInstant(issues, body, "endAt");
  if (startAt && endAt && endAt <= startAt) issues.push({ field: "endAt", message: "endAt must be later than startAt" });

  const { capacity } = body;
  if (typeof capacity !== "number" || !Number.isInteger(capacity) || capacity <= 0) {
    issues.push({ field: "capacity", message: "capacity must be a positive integer" });
  }

  if (issues.length > 0 || startAt === undefined || endAt === undefined || typeof capacity !== "number") {
    return { ok: false, issues };
  }

  return {
    ok: true,
    value: {
      title: body.title as string,
      description: body.description as string,
      location: body.location as string,
      startAt,
      endAt,
      capacity,
    },
  };
}

export function eventView(event: Pick<EventRecord, "id" | "title" | "description" | "location" | "startAt" | "endAt" | "capacity" | "publicationState">) {
  return {
    id: event.id,
    title: event.title,
    description: event.description,
    location: event.location,
    startAt: event.startAt.toISOString(),
    endAt: event.endAt.toISOString(),
    capacity: event.capacity,
    publicationState: event.publicationState,
  };
}
