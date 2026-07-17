const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { DatabaseSync } = require('node:sqlite');

const { updateThreadRecency } = require('../dist/stateDb');

test('returns undefined when Codex has no SQLite state database', (t) => {
  const directory = temporaryDirectory(t);

  assert.equal(updateThreadRecency(path.join(directory, 'state_5.sqlite'), 'thread-1'), undefined);
});

test('moves a thread above the global updated and recency high-water marks', (t) => {
  const stateDbPath = createStateDatabase(t);
  const database = new DatabaseSync(stateDbPath);
  insertThread(database, 'target', 10_000, 20_000);
  insertThread(database, 'newest', 200_000, 300_000);
  database.close();

  const result = updateThreadRecency(stateDbPath, 'target', new Date(100_000));

  assert.deepEqual(result, { updatedAtMs: 200_001, recencyAtMs: 300_001 });

  const verification = new DatabaseSync(stateDbPath, { readOnly: true });
  const target = verification.prepare('SELECT * FROM threads WHERE id = ?').get('target');
  const first = verification.prepare('SELECT id FROM threads ORDER BY recency_at_ms DESC LIMIT 1').get();
  verification.close();

  assert.equal(target.updated_at, 200);
  assert.equal(target.updated_at_ms, 200_001);
  assert.equal(target.recency_at, 300);
  assert.equal(target.recency_at_ms, 300_001);
  assert.equal(first.id, 'target');
});

test('uses the current time when it is above the stored high-water marks', (t) => {
  const stateDbPath = createStateDatabase(t);
  const database = new DatabaseSync(stateDbPath);
  insertThread(database, 'target', 10_000, 20_000);
  database.close();

  const result = updateThreadRecency(stateDbPath, 'target', new Date(500_000));

  assert.deepEqual(result, { updatedAtMs: 500_000, recencyAtMs: 500_000 });
});

test('rolls back when the requested thread is absent', (t) => {
  const stateDbPath = createStateDatabase(t);
  const database = new DatabaseSync(stateDbPath);
  insertThread(database, 'existing', 10_000, 20_000);
  database.close();

  assert.throws(
    () => updateThreadRecency(stateDbPath, 'missing', new Date(500_000)),
    /does not contain thread missing/
  );

  const verification = new DatabaseSync(stateDbPath, { readOnly: true });
  const existing = verification.prepare('SELECT updated_at_ms, recency_at_ms FROM threads').get();
  verification.close();
  assert.equal(existing.updated_at_ms, 10_000);
  assert.equal(existing.recency_at_ms, 20_000);
});

function createStateDatabase(t) {
  const stateDbPath = path.join(temporaryDirectory(t), 'state_5.sqlite');
  const database = new DatabaseSync(stateDbPath);
  database.exec(`
    CREATE TABLE threads (
      id TEXT PRIMARY KEY,
      updated_at INTEGER NOT NULL,
      updated_at_ms INTEGER NOT NULL,
      recency_at INTEGER NOT NULL,
      recency_at_ms INTEGER NOT NULL
    )
  `);
  database.close();
  return stateDbPath;
}

function insertThread(database, id, updatedAtMs, recencyAtMs) {
  database
    .prepare(`
      INSERT INTO threads (id, updated_at, updated_at_ms, recency_at, recency_at_ms)
      VALUES (?, ?, ?, ?, ?)
    `)
    .run(id, Math.floor(updatedAtMs / 1000), updatedAtMs, Math.floor(recencyAtMs / 1000), recencyAtMs);
}

function temporaryDirectory(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-bumper-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  return directory;
}
