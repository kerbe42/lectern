// Remembers the extension's folder between updates. Folder handles can be kept in IndexedDB
// (not in chrome.storage), and the browser asks again for write access when it has lapsed.

const DB = 'simple-reader-updater';
const STORE = 'handles';
const KEY = 'extension-folder';

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function run<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest): Promise<T> {
  const db = await open();
  try {
    return await new Promise<T>((resolve, reject) => {
      const req = fn(db.transaction(STORE, mode).objectStore(STORE));
      req.onsuccess = () => resolve(req.result as T);
      req.onerror = () => reject(req.error);
    });
  } finally {
    db.close();
  }
}

export async function loadFolder(): Promise<FileSystemDirectoryHandle | null> {
  return (await run<FileSystemDirectoryHandle | undefined>('readonly', s => s.get(KEY))) ?? null;
}
export async function saveFolder(dir: FileSystemDirectoryHandle): Promise<void> {
  await run('readwrite', s => s.put(dir, KEY));
}
export async function forgetFolder(): Promise<void> {
  await run('readwrite', s => s.delete(KEY));
}
