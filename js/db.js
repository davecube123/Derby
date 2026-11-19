// Small IndexedDB wrapper. All data stays on the user's own device.
const DB_NAME = 'derby';
const VERSION = 1;
let dbPromise;

function open() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('birds')) db.createObjectStore('birds', { keyPath: 'id' });
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

export async function putBirds(birds) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('birds', 'readwrite');
    const store = tx.objectStore('birds');
    for (const b of birds) store.put(b);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getMeta(key) {
  const row = await run('meta', 'readonly', (s) => s.get(key));
  return row ? row.value : undefined;
}
export const setMeta = (key, value) => run('meta', 'readwrite', (s) => s.put({ key, value }));
