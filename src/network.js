const STORAGE_KEY = 'crowd-shift.room.v1';
const ENTRY_KEY = 'crowd-shift.entry.v1';
const CODE_PATTERN = /^[A-Z2-9]{6}$/;
const TOKEN_PATTERN = /^[a-f0-9]{64}$/;
let pendingEntry = null;

export class NetworkError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

async function request(path, { token, body, signal } = {}) {
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal?.addEventListener('abort', abort, { once: true });
  const timeout = setTimeout(abort, 8000);
  try {
    if (signal?.aborted) throw new Error('cancelled');
    const response = await fetch(path, {
      method: body ? 'POST' : 'GET', cache: 'no-store', signal: controller.signal,
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) throw new NetworkError(response.status, data?.error || 'Room service is unavailable. Please try again.');
    if (!data) throw new NetworkError(503, 'Room service is unavailable. Please try again.');
    return data;
  } catch (error) {
    if (error instanceof NetworkError) throw error;
    throw new NetworkError(0, 'Connection interrupted. Reconnecting to check your latest move…');
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', abort);
  }
}

export function saveSession(session) {
  try {
    if (session) sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ code: session.code, token: session.token }));
    else sessionStorage.removeItem(STORAGE_KEY);
  } catch { /* Play still works when storage is blocked; refresh recovery will be unavailable. */ }
}

export function savedSession() {
  try {
    const value = JSON.parse(sessionStorage.getItem(STORAGE_KEY));
    return CODE_PATTERN.test(value?.code) && /^[a-f0-9]{64}$/.test(value?.token) ? value : null;
  } catch { return null; }
}

function readPendingEntry() {
  if (pendingEntry) return pendingEntry;
  try {
    const value = JSON.parse(sessionStorage.getItem(ENTRY_KEY));
    if (['create', 'join'].includes(value?.mode) && typeof value.name === 'string' &&
        typeof value.code === 'string' && TOKEN_PATTERN.test(value.entryKey)) pendingEntry = value;
  } catch { /* In-memory retries still work when browser storage is unavailable. */ }
  return pendingEntry;
}

function savePendingEntry(value) {
  pendingEntry = value;
  try {
    if (value) sessionStorage.setItem(ENTRY_KEY, JSON.stringify(value));
    else sessionStorage.removeItem(ENTRY_KEY);
  } catch { /* Keep the in-memory copy for the next attempt in this tab. */ }
}

export function pendingEntryDraft() {
  const entry = readPendingEntry();
  return entry ? { mode: entry.mode, name: entry.name, code: entry.code } : null;
}

export function invitedCode() {
  const code = new URL(window.location.href).searchParams.get('room')?.toUpperCase() || '';
  return CODE_PATTERN.test(code) ? code : '';
}

export function setRoomUrl(code) {
  const url = new URL(window.location.href);
  if (code) url.searchParams.set('room', code);
  else url.searchParams.delete('room');
  window.history.replaceState(null, '', url);
}

export function invitation(code) {
  const url = new URL('/', window.location.href);
  url.searchParams.set('room', code);
  return url.href;
}

export async function enterRoom(mode, name, code) {
  if (!['create', 'join'].includes(mode)) throw new NetworkError(400, 'Choose Create room or Join room.');
  const normalized = mode === 'create' ? '' : String(code || '').trim().toUpperCase();
  if (mode === 'join' && !CODE_PATTERN.test(normalized)) throw new NetworkError(400, 'Enter the six-character room code.');
  const cleanName = String(name || '').trim().slice(0, 20);
  let entry = readPendingEntry();
  // Keep this secret across retries: a lost response must not strand a claimed seat.
  if (!entry || entry.mode !== mode || entry.name !== cleanName || entry.code !== normalized) {
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    entry = { mode, name: cleanName, code: normalized,
      entryKey: Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('') };
    savePendingEntry(entry);
  }
  try {
    const session = await request(mode === 'create' ? '/api/rooms' : `/api/rooms/${normalized}/join`,
      { body: { name: cleanName, entryKey: entry.entryKey } });
    saveSession(session);
    savePendingEntry(null);
    return session;
  } catch (error) {
    // Network failures, server failures and rate limits may succeed on a later retry.
    if (error.status >= 400 && error.status < 500 && error.status !== 429) savePendingEntry(null);
    throw error;
  }
}

// Short polling keeps this dependency-free and works behind ordinary HTTP proxies.
export class RoomConnection {
  constructor(session, { onState, onConnection, onFatal }) {
    this.session = session;
    this.onState = onState;
    this.onConnection = onConnection;
    this.onFatal = onFatal;
    this.stopped = false;
    this.revision = -1;
    this.controller = new AbortController();
    this.timer = null;
  }

  accept(state) {
    if (this.stopped || state.revision < this.revision) return;
    this.revision = state.revision;
    this.onConnection(true);
    this.onState(state);
  }

  async poll() {
    if (this.stopped) return;
    clearTimeout(this.timer);
    try { this.accept(await request(`/api/rooms/${this.session.code}`, { token: this.session.token, signal: this.controller.signal })); }
    catch (error) {
      if (!this.stopped) {
        if ([401, 404, 410].includes(error.status)) { this.stop(); this.onFatal(error.message); return; }
        this.onConnection(false);
      }
    }
    if (!this.stopped) this.timer = setTimeout(() => this.poll(), 1000);
  }

  async act(type, state, choice) {
    try {
      const next = await request(`/api/rooms/${this.session.code}/actions`, {
        token: this.session.token, signal: this.controller.signal,
        body: { type, match: state?.match, round: state?.round, ...(choice ? { choice } : {}) },
      });
      this.accept(next);
    } catch (error) {
      if (!this.stopped && error.status === 0) this.onConnection(false);
      // Polling reconciles a response lost after a move was successfully saved.
      throw error;
    }
  }

  stop() { this.stopped = true; clearTimeout(this.timer); this.controller.abort(); }
}
