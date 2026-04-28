import { apiGet } from "./api";
import { getToken } from "./auth";

export async function getAssistantSummary() {
  const token = getToken();

  return apiGet("/api/asistente/summary", {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
}
