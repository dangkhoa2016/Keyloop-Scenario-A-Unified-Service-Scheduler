import test from 'node:test';
import assert from 'node:assert/strict';
import {runSimulation} from '../src/domain/simulation.js';
test('isolated sequential conflict rejects second booking',async()=>{
 const r=await runSimulation('conflict');
 assert.equal(r.confirmed,1);assert.equal(r.rejected,1);
 assert.equal(r.databaseConfirmed,1);assert.equal(r.integrity,'ok');
 assert.equal(r.results[0].httpStatus,201);assert.equal(r.results[1].code,'SLOT_UNAVAILABLE');
});
test('isolated 10-process race confirms only one',async()=>{
 const r=await runSimulation('concurrent');
 assert.equal(r.results.length,10);assert.equal(r.confirmed,1);assert.equal(r.rejected,9);
 assert.equal(r.databaseConfirmed,1);assert.equal(r.integrity,'ok');
 assert.ok(r.results.filter(x=>x.httpStatus===409).every(x=>x.code==='SLOT_UNAVAILABLE'));
});
