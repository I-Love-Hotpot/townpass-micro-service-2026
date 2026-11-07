import type { DocumentRecord, RecordCard } from '../interfaces/document.ts';

const stores = ['documents', 'cards', 'settings'];
const seedKey = 'fixtures-v1';

function request<T>(value: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    value.onsuccess = () => resolve(value.result);
    value.onerror = () => reject(value.error);
  });
}

export function openRecords(name = 'baihua') {
  let connection: Promise<IDBDatabase> | undefined;
  function open() {
    connection ??= new Promise<IDBDatabase>((resolve, reject) => {
      const opening = indexedDB.open(name, 1);
      opening.onupgradeneeded = () => {
        opening.result.createObjectStore('documents', { keyPath: 'id' });
        opening.result.createObjectStore('cards', { keyPath: 'id' });
        opening.result.createObjectStore('settings');
      };
      opening.onblocked = () => reject(new Error('IndexedDB is blocked by another tab'));
      opening.onerror = () => reject(opening.error);
      opening.onsuccess = () => {
        const db = opening.result;
        db.onversionchange = () => {
          db.close();
          connection = undefined;
        };
        resolve(db);
      };
    }).catch((error) => {
      connection = undefined;
      throw error;
    });
    return connection;
  }

  async function write<T>(
    operation: (transaction: IDBTransaction) => T | Promise<T>,
    signal?: AbortSignal
  ): Promise<T> {
    const db = await open();
    signal?.throwIfAborted();
    const transaction = db.transaction(stores, 'readwrite');
    const done = new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onabort = () =>
        reject(transaction.error ?? new DOMException('Aborted', 'AbortError'));
    });
    void done.catch(() => {});
    const cancel = () => {
      try {
        transaction.abort();
      } catch {
        /* The transaction already settled. */
      }
    };
    signal?.addEventListener('abort', cancel, { once: true });
    try {
      const result = await operation(transaction);
      await done;
      return result;
    } catch (error) {
      cancel();
      throw error;
    } finally {
      signal?.removeEventListener('abort', cancel);
    }
  }

  function put(transaction: IDBTransaction, record: DocumentRecord) {
    const { id, kind, createdAt, summary, status, scenarioDate, pages } = record;
    const card: RecordCard = {
      id,
      kind,
      createdAt,
      summary,
      status,
      scenarioDate,
      pageCount: pages.length
    };
    transaction.objectStore('documents').put(record);
    transaction.objectStore('cards').put(card);
  }

  async function read<T>(store: string, query: (objectStore: IDBObjectStore) => IDBRequest<T>) {
    const db = await open();
    return request(query(db.transaction(store).objectStore(store)));
  }

  return {
    list: async () => {
      const cards: RecordCard[] = await read('cards', (store) => store.getAll());
      return cards.sort((a, b) => b.createdAt - a.createdAt);
    },
    get: (id: string): Promise<DocumentRecord | undefined> =>
      read('documents', (store) => store.get(id)),
    put: (record: DocumentRecord, signal?: AbortSignal) =>
      write((transaction) => put(transaction, record), signal),
    delete: (id: string) =>
      write((transaction) => {
        transaction.objectStore('documents').delete(id);
        transaction.objectStore('cards').delete(id);
      }),
    update: (id: string, change: (record: DocumentRecord) => DocumentRecord) =>
      write(async (transaction) => {
        const record = await request<DocumentRecord | undefined>(
          transaction.objectStore('documents').get(id)
        );
        if (!record) throw new Error('Document no longer exists');
        const updated = change(record);
        put(transaction, updated);
        return updated;
      }),
    seeded: async () => Boolean(await read('settings', (store) => store.get(seedKey))),
    seed: (records: DocumentRecord[]) =>
      write(async (transaction) => {
        const settings = transaction.objectStore('settings');
        if (await request(settings.get(seedKey))) return;
        for (const record of records) put(transaction, record);
        settings.put(true, seedKey);
      })
  };
}

export const records = openRecords();
