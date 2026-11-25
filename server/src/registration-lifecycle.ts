export type RegistrationLifecycleStatus = "ACTIVE" | "CANCELLED";
export type CancellationDecision = "ALREADY_CANCELLED" | "REGISTRATION_CHECKED_IN" | "CANCELLATION_CLOSED" | "CANCEL";

export function decideCancellation(
  status: RegistrationLifecycleStatus,
  hasAttendance: boolean,
  eventStartAt: Date,
  decisionTime: Date,
): CancellationDecision {
  if (status === "CANCELLED") return "ALREADY_CANCELLED";
  if (hasAttendance) return "REGISTRATION_CHECKED_IN";
  return decisionTime.getTime() < eventStartAt.getTime() ? "CANCEL" : "CANCELLATION_CLOSED";
}
