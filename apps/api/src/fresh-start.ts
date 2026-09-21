import { backup } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createInterface } from 'node:readline/promises';
import { openDb, one, transaction, type DB } from './db.js';
import { hashPassword, id, now } from './core.js';
import { registerSchema } from '../../../packages/shared/src/index.js';

export async function freshStart(db: DB, input: unknown, archive: string) {
    const user = registerSchema.parse(input);
    if (user.email.endsWith('@atlas.demo')) throw new Error('Use your own email address, not an @atlas.demo address.');
    if (one(db,"SELECT id FROM users WHERE email NOT LIKE '%@atlas.demo' LIMIT 1")) {
        throw new Error('This database contains a non-demo account. No changes made. Use Team & access to deactivate demo users while keeping your real records.');
    }
    if (fs.existsSync(archive)) throw new Error('Backup path already exists. No changes made.');
    fs.mkdirSync(path.dirname(archive), { recursive: true });
    await backup(db, archive);
    transaction(db, () => {
        // Backup is complete before any mutation. Deletes and new admin creation are atomic.
        for (const table of ['notifications','sessions','messages','tickets','scans','custody','stops','routes','payments','invoices','locations','events','shipments','maintenance','vehicles','hubs','audit','users']) {
            db.exec(`DELETE FROM ${table}`);
        }
        db.prepare('INSERT INTO users VALUES(?,?,?,?,?,?,?,?)').run(id(),user.name,user.email,hashPassword(user.password),user.phone,'ADMIN',1,now());
    });
    return { email:user.email, archive };
}
async function secret(prompt: string): Promise<string> {
    if (!process.stdin.isTTY) throw new Error('Run this setup in an interactive VS Code terminal.');
    process.stdout.write(prompt);
    process.stdin.setRawMode(true);process.stdin.resume();process.stdin.setEncoding('utf8');
    return new Promise((resolve,reject) => {
        let value='';
        const finish=(error?:Error)=>{process.stdin.off('data',onData);process.stdin.setRawMode(false);process.stdin.pause();process.stdout.write('\n');error?reject(error):resolve(value);};
        const onData=(chunk:string)=>{for(const character of chunk){if(character==='\u0003'){finish(new Error('Setup cancelled.'));return;}if(character==='\r'||character==='\n'){finish();return;}if(character==='\u007f'||character==='\b'){value=value.slice(0,-1);}else if(character>=' '){value+=character;}}};
        process.stdin.on('data',onData);
    });
}
async function main(){
    // A running API may keep sessions and writes active; stop it before resetting demo data.
    let running=false;
    try { const response=await fetch(`http://127.0.0.1:${process.env.PORT||4000}/api/health`,{signal:AbortSignal.timeout(1000)});const health=await response.json() as {service?:string};running=health.service==='Atlas API'; } catch { /* No local API detected. */ }
    if(running)throw new Error('Stop Atlas with Ctrl+C before running npm run fresh-start.');
    console.log('Creates your administrator and removes demo accounts, shipments and payments from the active workspace. A complete database backup is saved first. Stop all Atlas server processes before continuing.');
    const rl=createInterface({input:process.stdin,output:process.stdout});
    let name:string,email:string,phone:string;
    try {name=await rl.question('Your name: ');email=await rl.question('Your email: ');phone=await rl.question('Phone number: ');}finally{rl.close();}
    const password=await secret('New password (12+ characters; typing is hidden): ');
    const confirmation=await secret('Repeat password: ');
    if(password!==confirmation)throw new Error('Passwords do not match. No changes made.');
    const dbPath=path.resolve(process.env.DB_PATH||'data/atlas.sqlite');
    const archive=path.join(path.dirname(dbPath),'backups',`before-fresh-start-${Date.now()}.sqlite`);
    const db=openDb(dbPath);
    try {const result=await freshStart(db,{name,email,phone,password},archive);console.log(`Administrator created: ${result.email}\nPrevious database backed up to: ${result.archive}\nRun npm run dev, then sign in with your new account. Do not run demo setup again.`);}finally{db.close();}
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===path.resolve(process.argv[1]))main().catch(error=>{console.error(error instanceof Error?error.message:error);process.exitCode=1;});
