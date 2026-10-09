import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {openDb} from './connection.js';
const initial=readFileSync(new URL('./migrations/001_initial.sql',import.meta.url),'utf8');
export function migrate(db){
 db.transaction(()=>{
   db.exec('CREATE TABLE IF NOT EXISTS schema_migrations(version TEXT PRIMARY KEY, applied_at_ms INTEGER NOT NULL)');
   db.exec(initial);
   db.prepare('INSERT OR IGNORE INTO schema_migrations(version,applied_at_ms) VALUES(?,?)').run('001_initial',Date.now());
 }).immediate();
 return true;
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const db=openDb();migrate(db);
 console.log('MIGRATION=PASS versions='+db.prepare('SELECT group_concat(version) v FROM schema_migrations').get().v);
 db.close();
}
