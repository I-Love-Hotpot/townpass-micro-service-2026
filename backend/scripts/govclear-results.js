import { readFileSync, existsSync } from 'node:fs';
import { createDatabasePool } from '../src/services/database.service.js';
if (existsSync('.env')) process.loadEnvFile();
const db = createDatabasePool();
try {
  const [action, id] = process.argv.slice(2);
  if (action === 'init') {
    await db.query(readFileSync(new URL('../migrations/001_govclear_results.sql', import.meta.url), 'utf8'));
    console.log('govclear_results ready');
  } else if (action === 'show' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id ?? '')) {
    const [rows] = await db.execute('SELECT payload, received_at FROM govclear_results WHERE result_id = ?', [id]);
    if (!rows.length) { console.error('Result not found'); process.exitCode = 1; }
    else console.log(JSON.stringify({receivedAt: rows[0].received_at, result: typeof rows[0].payload === 'string' ? JSON.parse(rows[0].payload) : rows[0].payload}, null, 2));
  } else if (action === 'list') {
    const [rows] = await db.query('SELECT result_id, received_at FROM govclear_results ORDER BY received_at DESC LIMIT 10');
    console.log(JSON.stringify(rows, null, 2));
  } else {
    console.error('Usage: govclear-results.js init | list | show <resultId>'); process.exitCode = 1;
  }
} catch (error) { console.error(`Result operation failed (${error.code ?? 'unknown'})`); process.exitCode = 1; }
finally { await db.end(); }
