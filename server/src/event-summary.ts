export interface EventSummary {
  eventId: string;
  capacity: number;
  activeCount: number;
  cancelledCount: number;
  remainingSeats: number;
  checkedInCount: number;
  notCheckedInCount: number;
  attendanceRate: number | null;
}

function asSafeCount(value: bigint | number, field: string): number {
  if (typeof value === "bigint") {
    if (value < 0n || value > BigInt(Number.MAX_SAFE_INTEGER)) throw new RangeError(`${field} is outside the safe integer range`);
    return Number(value);
  }
  if (!Number.isSafeInteger(value) || value < 0) throw new RangeError(`${field} must be a non-negative safe integer`);
  return value;
}

export function buildEventSummary(
  eventId: string,
  capacityValue: number,
  activeCountValue: bigint | number,
  cancelledCountValue: bigint | number,
  checkedInCountValue: bigint | number,
): EventSummary {
  const capacity = asSafeCount(capacityValue, "capacity");
  const activeCount = asSafeCount(activeCountValue, "activeCount");
  const cancelledCount = asSafeCount(cancelledCountValue, "cancelledCount");
  const checkedInCount = asSafeCount(checkedInCountValue, "checkedInCount");

  if (activeCount > capacity) throw new RangeError("activeCount exceeds capacity");
  if (checkedInCount > activeCount) throw new RangeError("checkedInCount exceeds activeCount");

  return {
    eventId,
    capacity,
    activeCount,
    cancelledCount,
    remainingSeats: capacity - activeCount,
    checkedInCount,
    notCheckedInCount: activeCount - checkedInCount,
    attendanceRate: activeCount === 0 ? null : Math.round((checkedInCount / activeCount) * 1000) / 10,
  };
}
