// Offline-tolerant action queue for driver mode (IndexedDB-backed so file
// blobs survive reloads). Arrived/Departed updates and photo uploads enqueue
// when offline and flush when connectivity returns.
const DB = "detention_offline";
const STORE = "queue";

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: "id" });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function store() {
  const db = await openDB();
  return db.transaction(STORE, "readwrite").objectStore(STORE);
}

export async function enqueue(item) {
  const id = (crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()));
  const record = { id, createdAt: Date.now(), ...item };
  const s = await store();
  return new Promise((resolve, reject) => {
    const r = s.add(record);
    r.onsuccess = () => resolve(record);
    r.onerror = () => reject(r.error);
  });
}

export async function getAll() {
  const s = await store();
  return new Promise((resolve, reject) => {
    const r = s.getAll();
    r.onsuccess = () => resolve(r.result || []);
    r.onerror = () => reject(r.error);
  });
}

export async function remove(id) {
  const s = await store();
  return new Promise((resolve, reject) => {
    const r = s.delete(id);
    r.onsuccess = () => resolve();
    r.onerror = () => reject(r.error);
  });
}