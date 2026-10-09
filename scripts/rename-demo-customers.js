import {openDb} from '../src/db/connection.js';
import {demoCustomers} from '../src/db/demo-customers.js';
import {fileURLToPath} from 'node:url';
export function renameDemoCustomers(db){
 const update=db.prepare('UPDATE customers SET display_name=? WHERE id=? AND display_name=?');
 const run=db.transaction(()=>demoCustomers.reduce((sum,[id,oldName,newName])=>sum+update.run(newName,id,oldName).changes,0));
 return run.immediate();
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const db=openDb();
 try{const changed=renameDemoCustomers(db);console.log('DEMO_CUSTOMER_RENAME=PASS changed='+changed+' appointments='+db.prepare('SELECT COUNT(*) n FROM appointments').get().n+' integrity='+db.pragma('integrity_check',{simple:true}));}
 finally{db.close();}
}
