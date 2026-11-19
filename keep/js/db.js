// Derby Keep storage (IndexedDB). Separate database from Derby; all data stays on this device.
const DB_NAME = 'derby-keep';
const VERSION = 1;
let dbPromise;

function open() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        for (const name of ['birds', 'logs', 'keeps']) {
          if (!db.objectStoreNames.contains(name)) db.createObjectStore(name, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta', { keyPath: 'key' });
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
    let result;
    const req = fn(tx.objectStore(storeName));
    if (req) req.onsuccess = () => { result = req.result; };
    tx.oncomplete = () => resolve(result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

async function many(storeName, fn) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    fn(tx.objectStore(storeName));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** Store helpers: all(), put(x), putMany([...]), remove([ids]), clear(). */
function store(name) {
  return {
    all: () => run(name, 'readonly', (s) => s.getAll()),
    put: (item) => run(name, 'readwrite', (s) => s.put(item)),
    putMany: (items) => many(name, (s) => items.forEach((i) => s.put(i))),
    remove: (ids) => many(name, (s) => ids.forEach((id) => s.delete(id))),
    clear: () => run(name, 'readwrite', (s) => s.clear()),
  };
}

export const birds = store('birds');
export const logs = store('logs');
export const keeps = store('keeps');

export async function getMeta(key) {
  const row = await run('meta', 'readonly', (s) => s.get(key));
  return row ? row.value : undefined;
}
export const setMeta = (key, value) => run('meta', 'readwrite', (s) => s.put({ key, value }));
