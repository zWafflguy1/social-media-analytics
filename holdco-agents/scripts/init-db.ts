import { db } from '../shared/db/client.js';

const d = db();
console.log('DB initialized at', process.env.DB_PATH ?? './data/holdco.db');
console.log('Tables:', (d.prepare(`SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`).all() as Array<{ name: string }>).map((r) => r.name).join(', '));
