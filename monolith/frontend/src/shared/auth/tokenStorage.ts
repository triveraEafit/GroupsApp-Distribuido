const KEY = "groupsapp_token";
const USERNAME_KEY = "groupsapp_username";
const KNOWN_USERS_KEY = "groupsapp_known_users";

function migrateFromLocalStorage(key: string) {
  const current = sessionStorage.getItem(key);
  if (current) return current;

  const legacy = localStorage.getItem(key);
  if (!legacy) return null;

  sessionStorage.setItem(key, legacy);
  localStorage.removeItem(key);
  return legacy;
}

function parseKnownUsers(raw: string | null) {
  if (!raw) return {};

  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export const tokenStorage = {
  get() {
    return migrateFromLocalStorage(KEY);
  },
  set(token: string, username?: string) {
    sessionStorage.setItem(KEY, token);
    localStorage.removeItem(KEY);
    if (username) {
      this.setUsername(username);
    }
  },
  clear() {
    sessionStorage.removeItem(KEY);
    sessionStorage.removeItem(USERNAME_KEY);
    sessionStorage.removeItem(KNOWN_USERS_KEY);
    localStorage.removeItem(KEY);
    localStorage.removeItem(USERNAME_KEY);
  },
  getUsername() {
    return migrateFromLocalStorage(USERNAME_KEY);
  },
  setUsername(username: string) {
    sessionStorage.setItem(USERNAME_KEY, username);
    localStorage.removeItem(USERNAME_KEY);
  },
  getKnownUsers() {
    const sessionUsers = parseKnownUsers(sessionStorage.getItem(KNOWN_USERS_KEY));
    const localUsers = parseKnownUsers(localStorage.getItem(KNOWN_USERS_KEY));
    return { ...localUsers, ...sessionUsers };
  },
  rememberKnownUser(userId: number | null, username: string | null) {
    if (!userId || !username?.trim()) return;

    const knownUsers = this.getKnownUsers();
    knownUsers[String(userId)] = username.trim();
    sessionStorage.setItem(KNOWN_USERS_KEY, JSON.stringify(knownUsers));
    localStorage.setItem(KNOWN_USERS_KEY, JSON.stringify(knownUsers));
  },
  getKnownUsername(userId: number | null) {
    if (!userId) return null;
    const knownUsers = this.getKnownUsers();
    return knownUsers[String(userId)] || null;
  },
};
