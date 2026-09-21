import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { openDb, one } from '../src/db.js';
import { seed } from '../src/seed.js';
import { freshStart } from '../src/fresh-start.js';
import { createApp } from '../src/app.js';
test('fresh start archives demo data and replaces it with a working administrator', async()=>{
 const dir=mkdtempSync(path.join(tmpdir(),'atlas-reset-')),db=openDb(':memory:');
 try {
  seed(db);const archive=path.join(dir,'backup.sqlite');
  await freshStart(db,{name:'Project Owner',email:'owner@example.com',phone:'+123456789',password:'PrivateTest!2026'},archive);
  assert.equal(one<{n:number}>(db,'SELECT COUNT(*) n FROM users')!.n,1);
  assert.equal(one<{n:number}>(db,'SELECT COUNT(*) n FROM shipments')!.n,0);
  assert.equal(one<{n:number}>(db,'SELECT COUNT(*) n FROM payments')!.n,0);
  const old=openDb(archive);assert.equal(one<{n:number}>(old,'SELECT COUNT(*) n FROM shipments')!.n,30);old.close();
  const app=createApp(db);
  await request(app).post('/api/auth/login').send({email:'admin@atlas.demo',password:'AtlasDemo!2026'}).expect(401);
  const login=await request(app).post('/api/auth/login').send({email:'owner@example.com',password:'PrivateTest!2026'}).expect(200);
  assert.equal(login.body.user.role,'ADMIN');
  await assert.rejects(freshStart(db,{name:'Other Owner',email:'other@example.com',phone:'+123456789',password:'PrivateTest!2026'},path.join(dir,'other.sqlite')),/non-demo/);
 } finally {db.close();rmSync(dir,{recursive:true,force:true});}
});
test('invalid credentials leave demo records intact',async()=>{
 const db=openDb(':memory:');seed(db);
 try {await assert.rejects(freshStart(db,{name:'Owner',email:'owner@example.com',phone:'+123456789',password:'short'},'/not-used.sqlite'));assert.equal(one<{n:number}>(db,'SELECT COUNT(*) n FROM shipments')!.n,30);}finally{db.close();}
});
