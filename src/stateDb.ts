import { existsSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

const REQUIRED_THREAD_COLUMNS = [
  'id',
  'updated_at',
  'updated_at_ms',
  'recency_at',
  'recency_at_ms'
] as const;

export interface ThreadRecencyUpdate {
  updatedAtMs: number;
  recencyAtMs: number;
}

export function updateThreadRecency(
  stateDbPath: string,
  threadId: string,
  now: Date = new Date()
): ThreadRecencyUpdate | undefined {
  if (!existsSync(stateDbPath)) {
    return undefined;
  }

  const nowMs = now.getTime();
  if (!Number.isSafeInteger(nowMs)) {
    throw new Error('Cannot update Codex history with an invalid timestamp.');
  }

  const database = new DatabaseSync(stateDbPath);
  let transactionStarted = false;

  try {
    database.exec('PRAGMA busy_timeout = 5000');
    assertThreadSchema(database);
    database.exec('BEGIN IMMEDIATE');
    transactionStarted = true;

    const highWater = database
      .prepare(`
        SELECT
          COALESCE(MAX(updated_at_ms), 0) AS max_updated_at_ms,
          COALESCE(MAX(recency_at_ms), 0) AS max_recency_at_ms
        FROM threads
      `)
      .get() as Record<string, unknown> | undefined;
    const updatedAtMs = Math.max(nowMs, readInteger(highWater?.max_updated_at_ms) + 1);
    const recencyAtMs = Math.max(nowMs, readInteger(highWater?.max_recency_at_ms) + 1);

    const result = database
      .prepare(`
        UPDATE threads
        SET
          updated_at = ?,
          updated_at_ms = ?,
          recency_at = ?,
          recency_at_ms = ?
        WHERE id = ?
      `)
      .run(
        Math.floor(updatedAtMs / 1000),
        updatedAtMs,
        Math.floor(recencyAtMs / 1000),
        recencyAtMs,
        threadId
      );

    if (readInteger(result.changes) !== 1) {
      throw new Error(`Codex state database does not contain thread ${threadId}.`);
    }

    database.exec('COMMIT');
    transactionStarted = false;
    return { updatedAtMs, recencyAtMs };
  } catch (error) {
    if (transactionStarted) {
      try {
        database.exec('ROLLBACK');
      } catch {
        // Preserve the original database error.
      }
    }
    throw error;
  } finally {
    database.close();
  }
}

function assertThreadSchema(database: DatabaseSync): void {
  const columns = database.prepare('PRAGMA table_info(threads)').all() as Array<Record<string, unknown>>;
  const names = new Set(columns.map((column) => column.name).filter((name): name is string => typeof name === 'string'));
  const missing = REQUIRED_THREAD_COLUMNS.filter((column) => !names.has(column));

  if (missing.length > 0) {
    throw new Error(`Unsupported Codex state database: threads is missing ${missing.join(', ')}.`);
  }
}

function readInteger(value: unknown): number {
  if (typeof value === 'bigint') {
    const converted = Number(value);
    if (Number.isSafeInteger(converted)) {
      return converted;
    }
  }

  if (typeof value === 'number' && Number.isSafeInteger(value)) {
    return value;
  }

  throw new Error('Codex state database contains an invalid history timestamp.');
}
