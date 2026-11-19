// Small IndexedDB wrapper. All data stays on the user's own device.
const DB_NAME = 'derby';
const VERSION = 2; // v2 adds conditioning logs and keeps
let dbPromise;

function open() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('birds')) db.createObjectStore('birds', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta', { keyPath: 'key' });
        if (!db.objectStoreNames.contains('logs')) db.createObjectStore('logs', { keyPath: 'id' }).createIndex('birdId', 'birdId');
        if (!db.objectStoreNames.contains('keeps')) db.createObjectStore('keeps', { keyPath: 'id' }).createIndex('birdId', 'birdId');
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbPromise;
}

async function run(storeName, mode, fn) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const store = tx.objectStore(storeName);
    let result;
    const req = fn(store);
    if (req) req.onsuccess = () => { result = req.result; };
    tx.oncomplete = () => resolve(result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export const getAllBirds = () => run('birds', 'readonly', (s) => s.getAll());
export const putBird = (bird) => run('birds', 'readwrite', (s) => s.put(bird));
export const deleteBird = (id) => run('birds', 'readwrite', (s) => s.delete(id));
export const clearBirds = () => run('birds', 'readwrite', (s) => s.clear());

async function putMany(storeName, items) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    for (const item of items) store.put(item);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export const putBirds = (birds) => putMany('birds', birds);

// Logs and keeps from Derby v0.4 (now in Derby Keep): read for backups, cleared with "delete all".
export const getAllLogs = () => run('logs', 'readonly', (s) => s.getAll());
export const clearLogs = () => run('logs', 'readwrite', (s) => s.clear());
export const getAllKeeps = () => run('keeps', 'readonly', (s) => s.getAll());
export const clearKeeps = () => run('keeps', 'readwrite', (s) => s.clear());

export async function getMeta(key) {
  const row = await run('meta', 'readonly', (s) => s.get(key));
  return row ? row.value : undefined;
}
export const setMeta = (key, value) => run('meta', 'readwrite', (s) => s.put({ key, value }));
