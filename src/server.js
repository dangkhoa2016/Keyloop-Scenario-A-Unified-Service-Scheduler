import {serve} from '@hono/node-server';import {openDb} from './db/connection.js';import {migrate} from './db/migrate.js';import {createApp} from './app.js';
const db=openDb();migrate(db);const port=Number(process.env.PORT||3000),hostname=process.env.HOST||'127.0.0.1';
const server=serve({fetch:createApp(db).fetch,port,hostname},()=>console.log('LISTENING=http://'+hostname+':'+port));
function shutdown(){server.close(()=>{db.close();process.exit(0);});}
process.on('SIGTERM',shutdown);process.on('SIGINT',shutdown);
