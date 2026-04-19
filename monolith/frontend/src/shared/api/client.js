import { tokenStorage } from "@/shared/auth/tokenStorage";

export function setToken(token, username) {
  tokenStorage.set(token, username);
}
export function getToken() {
  return tokenStorage.get();
}
export function clearToken() {
  tokenStorage.clear();
}

export function getCurrentUsername() {
  return tokenStorage.getUsername();
}

export function getUserIdFromToken() {
  const token = getToken();
  if (!token) return null;

  try {
    const base64 = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
    const payload = JSON.parse(atob(padded));
    return Number(payload.sub);
  } catch {
    return null;
  }
}

async function request(path, { method = "GET", headers = {}, body } = {}) {
  const token = getToken();

  const finalHeaders = {
    ...headers,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const res = await fetch(`/api${path}`, {
    method,
    headers: finalHeaders,
    body,
  });

  const contentType = res.headers.get("content-type") || "";
  const data = contentType.includes("application/json")
    ? await res.json().catch(() => null)
    : await res.text().catch(() => null);

  if (!res.ok) {
    if (res.status === 401) {
      clearToken();
      window.location.href = "/login";
    }

    const msg =
      (data &&
        data.detail &&
        (typeof data.detail === "string"
          ? data.detail
          : JSON.stringify(data.detail))) ||
      (typeof data === "string" && data) ||
      `Request failed (${res.status})`;

    const err = new Error(msg);
    err.status = res.status;
    err.data = data;
    throw err;
  }

  return data;
}

// ---- Auth ----
export async function register({ username, email, password }) {
  return request("/users/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, email, password }),
  });
}

export async function login({ username, password }) {
  const form = new URLSearchParams();
  form.set("username", username);
  form.set("password", password);

  const data = await request("/users/login", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString(),
  });

  const token = data?.access_token || data?.token;
  if (!token) throw new Error("Login OK but no token returned by backend.");
  setToken(token, username.trim());
  tokenStorage.rememberKnownUser(getUserIdFromToken(), username.trim());
  return data;
}

// ---- Groups ----
export async function createGroup({ name, description }) {
  return request("/groups/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, description }),
  });
}

export async function joinGroup(groupId) {
  return request(`/groups/${groupId}/join`, { method: "POST" });
}

export async function getMyGroups() {
  return request("/groups/my-groups");
}

export async function getGroupMessages(groupId) {
  return request(`/groups/${groupId}/messages`);
}

export async function getDirectHistory(username) {
  return request(`/groups/dm/history/${encodeURIComponent(username)}`);
}

export async function getUnreadDirectMessages() {
  return request("/groups/dm/unread");
}

export async function markDirectMessagesAsRead(username) {
  return request(`/groups/dm/mark-read/${encodeURIComponent(username)}`, {
    method: "POST",
  });
}

export async function uploadFileToUser(username, file) {
  const token = getToken();
  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch(`/api/groups/dm/upload/${encodeURIComponent(username)}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`
    },
    body: formData
  });

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    if (res.status === 401) {
      clearToken();
      window.location.href = "/login";
    }
    const msg = data?.detail || 'Upload failed';
    throw new Error(msg);
  }

  return data;
}

export function getFileDownloadUrl(messageId) {
  const token = getToken();
  return `/api/groups/dm/download/${messageId}?token=${encodeURIComponent(token)}`;
}
