import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';import {tmpdir} from 'node:os';
import {openDb} from '../src/db/connection.js';
import {migrate} from '../src/db/migrate.js';
import {seedRich} from '../src/db/seed-rich.js';
const dir=mkdtempSync(join(tmpdir(),'keyloop-rich-'));const db=openDb(join(dir,'test.sqlite'));
test.after(()=>{db.close();rmSync(dir,{recursive:true,force:true});});
test('rich seed populates all primary entities and is repeatable',()=>{
 migrate(db);const first=seedRich(db),second=seedRich(db);
 assert.deepEqual(second,first);
 for(const [table,min] of Object.entries({dealerships:6,customers:20,vehicles:20,technicians:32,service_bays:32,service_types:10,skills:10}))assert.ok(first[table]>=min,table+' count');
});
test('all vehicles resolve to their customer',()=>assert.equal(db.prepare('SELECT count(*) n FROM vehicles v LEFT JOIN customers c ON c.id=v.customer_id WHERE c.id IS NULL').get().n,0));
test('all listed service bays belong to existing dealers',()=>assert.equal(db.prepare('SELECT count(*) n FROM service_bays b LEFT JOIN dealerships d ON d.id=b.dealership_id WHERE d.id IS NULL').get().n,0));
test('existing baseline resources unchanged',()=>{assert.equal(db.prepare('SELECT name FROM technicians WHERE id=?').get('tech_001').name,'Morgan');assert.equal(db.prepare('SELECT name FROM service_bays WHERE id=?').get('bay_001').name,'Bay A');});
