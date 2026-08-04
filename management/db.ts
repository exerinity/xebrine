const DB_NAME = 'xebrine';
const DB_VERSION = 3;

export type StoreName = 'folders' | 'tracks' | 'lyrics' | 'covers' | 'scrobbles';

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('folders')) db.createObjectStore('folders', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('tracks')) db.createObjectStore('tracks', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('lyrics')) db.createObjectStore('lyrics', { keyPath: 'trackId' });
      if (!db.objectStoreNames.contains('covers')) db.createObjectStore('covers', { keyPath: 'key' });
      if (!db.objectStoreNames.contains('scrobbles')) db.createObjectStore('scrobbles', { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function dbPut(store: StoreName, value: unknown): Promise<void> {
  const db = await openDb();
  await request(db.transaction(store, 'readwrite').objectStore(store).put(value));
}

export async function dbGet<T>(store: StoreName, key: IDBValidKey): Promise<T | undefined> {
  const db = await openDb();
  return request(db.transaction(store, 'readonly').objectStore(store).get(key)) as Promise<T | undefined>;
}

export async function dbGetAll<T>(store: StoreName): Promise<T[]> {
  const db = await openDb();
  return request(db.transaction(store, 'readonly').objectStore(store).getAll()) as Promise<T[]>;
}

export async function dbDelete(store: StoreName, key: IDBValidKey): Promise<void> {
  const db = await openDb();
  await request(db.transaction(store, 'readwrite').objectStore(store).delete(key));
}

export async function dbWriteBatch(
  store: StoreName,
  puts: readonly unknown[] = [],
  deletes: readonly IDBValidKey[] = []
): Promise<void> {
  if (puts.length === 0 && deletes.length === 0) return;
  const db = await openDb();
  const tx = db.transaction(store, 'readwrite', { durability: 'relaxed' });
  const objectStore = tx.objectStore(store);
  for (const value of puts) objectStore.put(value);
  for (const key of deletes) objectStore.delete(key);
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export async function dbClear(store: StoreName): Promise<void> {
  const db = await openDb();
  await request(db.transaction(store, 'readwrite').objectStore(store).clear());
}
