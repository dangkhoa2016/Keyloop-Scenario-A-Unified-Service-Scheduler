import {openDb} from '../src/db/connection.js';import {mkdirSync} from 'node:fs';import {resolve} from 'node:path';
const db=openDb();const dir=resolve('backups');mkdirSync(dir,{recursive:true});const target=resolve(dir,'scheduler-safe-backup.sqlite');
await db.backup(target);console.log('SQLITE_BACKUP='+target);db.close();
const copy=openDb(target);const check=copy.pragma('integrity_check',{simple:true});const count=copy.prepare('SELECT count(*) as n FROM appointments').get().n;copy.close();console.log('BACKUP_INTEGRITY='+check+' APPOINTMENTS='+count);if(check!=='ok')process.exitCode=1;
