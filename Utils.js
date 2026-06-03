/**
 * NexFounder — Shared Utilities
 * XSS protection, caching, rate limiting, and Firestore helpers
 */

// ── XSS PROTECTION ────────────────────────────────────────────────────────────
// Centralised escaping; use on ALL user-generated text before inserting into DOM

const ESCAPE_MAP = { "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#x27;","/":"&#x2F;" };

/**
 * Escape a string for safe HTML insertion.
 * Always use this instead of raw interpolation.
 */
export function esc(str) {
  if (str == null) return "";
  return String(str).replace(/[&<>"'/]/g, c => ESCAPE_MAP[c]);
}

/**
 * Sanitise a URL — only allow http/https/data:image (for avatars).
 * Returns "" for javascript: and other dangerous schemes.
 */
export function safeUrl(url) {
  if (!url) return "";
  const s = String(url).trim();
  if (/^(https?:\/\/|data:image\/)/i.test(s)) return s;
  return "";
}

/**
 * Build an avatar element string safely.
 * @param {object} user  — object with photoURL, initials, displayName
 * @param {string} size  — CSS size string, e.g. "44px"
 */
export function avatarHTML(user = {}, size = "44px") {
  const url = safeUrl(user.photoURL);
  const fallback = esc(user.initials || (user.displayName || "?").slice(0, 2).toUpperCase());
  if (url) {
    return `<img src="${url}" alt="${esc(user.displayName || "User")}" `
         + `style="width:100%;height:100%;object-fit:cover;border-radius:50%;" loading="lazy">`;
  }
  return fallback;
}

// ── IN-MEMORY USER CACHE ──────────────────────────────────────────────────────
// Prevents re-fetching the same user document on every render.
// TTL = 5 minutes (profile edits propagate quickly enough).

const USER_CACHE = new Map();          // uid → { data, fetchedAt }
const CACHE_TTL  = 5 * 60 * 1000;     // 5 min

export function cacheUser(uid, data) {
  USER_CACHE.set(uid, { data, fetchedAt: Date.now() });
}

export function getCachedUser(uid) {
  const entry = USER_CACHE.get(uid);
  if (!entry) return null;
  if (Date.now() - entry.fetchedAt > CACHE_TTL) { USER_CACHE.delete(uid); return null; }
  return entry.data;
}

export function clearUserCache(uid) {
  USER_CACHE.delete(uid);
}

// ── LISTENER REGISTRY ────────────────────────────────────────────────────────
// Tracks active onSnapshot unsubscribers so pages can clean them up on unload,
// preventing memory / quota leaks from stale listeners.

const _unsubs = [];

export function trackUnsub(fn) {
  _unsubs.push(fn);
  return fn;
}

export function cleanupAll() {
  while (_unsubs.length) _unsubs.pop()();
}

// Auto-cleanup on page hide (back/forward cache friendly)
if (typeof window !== "undefined") {
  window.addEventListener("pagehide",  cleanupAll);
  window.addEventListener("beforeunload", cleanupAll);
}

// ── TIME FORMATTING ───────────────────────────────────────────────────────────
export function timeAgo(ms) {
  const diff = Date.now() - ms;
  const m = Math.floor(diff / 60_000);
  if (m < 1)  return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 3600);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function formatTime(ts) {
  if (!ts?.toDate) return "";
  return ts.toDate().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

// ── DEBOUNCE ──────────────────────────────────────────────────────────────────
export function debounce(fn, ms = 300) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

// ── INITIALS ──────────────────────────────────────────────────────────────────
export function initials(name = "") {
  return name.split(" ").filter(Boolean).map(w => w[0]).join("").toUpperCase().slice(0, 2) || "?";
}
