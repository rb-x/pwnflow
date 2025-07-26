/**
 * Parse ISO timestamp with nanosecond precision from backend
 * Backend returns timestamps like: "2025-07-22T19:14:52.228000000Z"
 * JavaScript Date constructor expects: "2025-07-22T19:14:52.228Z"
 */
export function parseBackendTimestamp(
  timestamp: string | undefined | null
): Date {
  if (!timestamp) {
    return new Date(); // Return current date as fallback
  }

  // Remove nanosecond precision (9 digits) and keep only milliseconds (3 digits)
  const normalizedTimestamp = timestamp.replace(/\.(\d{3})\d{6}Z$/, ".$1Z");
  return new Date(normalizedTimestamp);
}

/**
 * Format a date as relative time (e.g., "5m ago", "2h ago", "3d ago")
 * or as a localized date string for older dates
 */
export function formatRelativeTime(date: Date): string {
  if (isNaN(date.getTime())) return "Invalid date";

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffSeconds < 60) {
    return "just now";
  } else if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  } else if (diffHours < 24) {
    return `${diffHours}h ago`;
  } else if (diffDays < 7) {
    return `${diffDays}d ago`;
  } else if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7);
    return `${weeks}w ago`;
  } else {
    // For older dates, show the actual date
    return date.toLocaleDateString();
  }
}

/**
 * Format timestamp from backend with relative time
 */
export function formatBackendTimestamp(
  timestamp: string | undefined | null
): string {
  if (!timestamp) {
    return "-";
  }

  const date = parseBackendTimestamp(timestamp);
  return formatRelativeTime(date);
}
