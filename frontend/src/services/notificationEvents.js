export const NOTIFICATIONS_REFRESH_EVENT = "nanipadel:notifications-refresh";

export function requestNotificationsRefresh() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(NOTIFICATIONS_REFRESH_EVENT));
  }
}
