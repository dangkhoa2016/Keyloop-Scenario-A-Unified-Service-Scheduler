import Database from 'better-sqlite3';
import {resolve} from 'node:path';
import {mkdirSync} from 'node:fs';
import {dirname} from 'node:path';
export function openDb(path=process.env.DATABASE_PATH||'./data/scheduler.sqlite'){
 const absolute=path===':memory:'?path:resolve(path);if(path!==':memory:')mkdirSync(dirname(absolute),{recursive:true});
 const db=new Database(absolute,{timeout:5000});db.pragma('foreign_keys=ON');if(path!==':memory:')db.pragma('journal_mode=WAL');db.pragma('busy_timeout=5000');return db;
}
