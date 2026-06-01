// PORT-NOTE: Direct port of isThrottled utility.
// MESSAGING_THROTTLE_DURATION constant inlined (1 minute) since the messaging
// module constants may not yet be ported. isValidDate inlined for self-containment.

const MESSAGING_THROTTLE_DURATION = 1000 * 60 * 1; // 1 minute

const isValidDate = (date: unknown): date is Date =>
  date instanceof Date && !isNaN(date.getTime());

export const isThrottled = (
  syncStageStartedAt: string | null,
  throttleFailureCount: number,
  throttleRetryAfter?: string | null,
): boolean => {
  const now = new Date();

  const retryAfterCandidate =
    throttleRetryAfter != null ? new Date(throttleRetryAfter) : null;
  const retryAfterDate = isValidDate(retryAfterCandidate)
    ? retryAfterCandidate
    : null;

  if (retryAfterDate != null && retryAfterDate > now) {
    return true;
  }

  if (!syncStageStartedAt) {
    return false;
  }

  if (throttleFailureCount === 0) {
    return false;
  }

  const exponentialBackoffUntil = computeThrottlePauseUntil(
    syncStageStartedAt,
    throttleFailureCount,
  );

  return exponentialBackoffUntil > now;
};

const computeThrottlePauseUntil = (
  syncStageStartedAt: string,
  throttleFailureCount: number,
): Date => {
  return new Date(
    new Date(syncStageStartedAt).getTime() +
      MESSAGING_THROTTLE_DURATION * Math.pow(2, throttleFailureCount - 1),
  );
};
