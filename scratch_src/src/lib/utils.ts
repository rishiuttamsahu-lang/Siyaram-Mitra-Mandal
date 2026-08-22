import { Firestore, writeBatch, WriteBatch } from "firebase/firestore";

/**
 * Safely extracts a millisecond timestamp from Firestore Timestamps, ISO strings,
 * numeric timestamps, or lastUpdated fields.
 */
export function getTimestampMillis(item: any): number {
  if (!item) return 0;
  if (item.timestamp?.seconds) return item.timestamp.seconds * 1000;
  if (typeof item.timestamp?.toDate === 'function') return item.timestamp.toDate().getTime();
  if (typeof item.createdAt === 'string') {
    const t = new Date(item.createdAt).getTime();
    if (!isNaN(t)) return t;
  }
  if (typeof item.createdAt === 'number') return item.createdAt;
  if (typeof item.timestamp === 'string') {
    const t = new Date(item.timestamp).getTime();
    if (!isNaN(t)) return t;
  }
  if (typeof item.timestamp === 'number') return item.timestamp;
  if (item.lastUpdated) {
    const t = new Date(item.lastUpdated).getTime();
    if (!isNaN(t)) return t;
  }
  return 0;
}

/**
 * Commits Firestore operations in chunks of max 400 operations per batch
 * to avoid hitting the 500-operation Firestore limit.
 */
export async function commitChunkedBatches(
  db: Firestore,
  operations: Array<(batch: WriteBatch) => void>
): Promise<void> {
  const CHUNK_SIZE = 400;
  for (let i = 0; i < operations.length; i += CHUNK_SIZE) {
    const batch = writeBatch(db);
    const chunk = operations.slice(i, i + CHUNK_SIZE);
    chunk.forEach((op) => op(batch));
    await batch.commit();
  }
}
