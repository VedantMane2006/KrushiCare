import Dexie, { type EntityTable } from 'dexie';
import type { Check } from './types';

export const db = new Dexie('agrisense') as Dexie & { checks: EntityTable<Check, 'client_id'> };

db.version(1).stores({
  // Indexed fields only; the blob and result are stored but not indexed.
  checks: 'client_id, status, captured_at, next_try_at',
});
