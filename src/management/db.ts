const DB_NAME = 'xebrine';
const DB_VERSION = 2;

export type StoreName = 'folders' | 'tracks' | 'lyrics' | 'covers';

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

export async function dbClear(store: StoreName): Promise<void> {
  const db = await openDb();
  await request(db.transaction(store, 'readwrite').objectStore(store).clear());
}
