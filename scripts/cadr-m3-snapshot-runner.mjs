#!/usr/bin/env node
/* Restore a native CDRSNAP1 into the M3 worker and emit its continuation. */
import { readFile, writeFile } from "node:fs/promises";
import { createWriteStream } from "node:fs";
import { Worker } from "node:worker_threads";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),".."); const BATCH=4096;
function frame(magic, count, slots, status=0) { const b=Buffer.alloc(32); b.write(magic); if(magic==="CDRM3TR1"){b.writeUInt32LE(96,8);b.writeBigUInt64LE(BigInt(count),12);b.writeBigUInt64LE(BigInt(slots),20);} else {b.writeBigUInt64LE(BigInt(count),8);b.writeUInt32LE(status,16);} return b; }
class Client { constructor(w){this.w=w;this.n=1;this.q=new Map();w.on("message",m=>{const x=this.q.get(m.id);if(x){this.q.delete(m.id);x(m);}});} call(op,x={},t=[]){const id=this.n++;return new Promise(r=>{this.q.set(id,r);this.w.postMessage({version:1,id,op,...x},t);});} async ok(op,x={},t=[]){const r=await this.call(op,x,t);if(r.status!==0)throw Error(`${op}: ${JSON.stringify(r)}`);return r;} }
function assertM3Snapshot(bytes, label) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes.byteLength < 256 || new TextDecoder().decode(bytes.subarray(0, 8)) !== "CDRSNAP1" ||
      view.getUint16(10, true) !== 1 || view.getUint32(20, true) !== 9) {
    throw Error(`${label} is not an ABI1.2/minor1 nine-chunk CDRSNAP1`);
  }
  const headerBytes = view.getUint32(12, true);
  const directoryEntryBytes = view.getUint32(24, true);
  if (headerBytes !== 264 || directoryEntryBytes !== 64) throw Error(`${label} has an invalid directory layout`);
  let sawD0 = false;
  for (let index = 0; index < 9; index += 1) {
    if (view.getUint32(headerBytes + index * directoryEntryBytes, true) === 9) sawD0 = true;
  }
  if (!sawD0) throw Error(`${label} has no D0 disk chunk`);
}
async function assertDisk(c, label) {
  const disk = await c.ok("disk-observation");
  if (disk.diskStatus !== 5n || disk.interruptPending !== 0n) {
    throw Error(`${label} changed the nondefault D0 disk observation`);
  }
}
const [wasm,snapshot,slotsText,output,savedSnapshot]=process.argv.slice(2); const slots=Number(slotsText); if(!wasm||!snapshot||!Number.isSafeInteger(slots)||slots<=0) throw Error("usage: WASM SNAPSHOT SLOTS OUTPUT [SAVED-SNAPSHOT]");
const worker=new Worker(pathToFileURL(resolve(ROOT,"cadr-web/wasm/cadr-worker.js")),{type:"module"}); const c=new Client(worker); const out=createWriteStream(output,{flags:"w"});
try { const module=await WebAssembly.compile(await readFile(wasm)); await c.ok("instantiate",{module}); const bytes=await readFile(snapshot); assertM3Snapshot(bytes,"input snapshot"); for(let attempt=1;attempt<=4;attempt+=1){const bad=Uint8Array.from(bytes);bad[bad.byteLength-attempt]^=1;const badab=bad.buffer;const rejected=await c.call("snapshot-restore-import",{snapshot:badab},[badab]);if(rejected.status===0)throw Error(`late-digest-corrupt snapshot ${attempt} was accepted`);} const ab=bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength); await c.ok("snapshot-restore-import",{snapshot:ab},[ab]); await assertDisk(c,"restored input snapshot"); if(savedSnapshot){const saved=await c.ok("snapshot-save");const savedBytes=new Uint8Array(saved.snapshot);assertM3Snapshot(savedBytes,"Wasm-produced snapshot");await writeFile(savedSnapshot,savedBytes);await assertDisk(c,"Wasm snapshot save");} out.write(frame("CDRM3TR1",slots+1,slots)); let d=await c.ok("boundary-digests-v3");out.write(Buffer.from(d.digests));let count=1,terminal=0;for(let done=0;done<slots;){const r=await c.ok("run-digest-batch-v3",{clockSlots:Math.min(BATCH,slots-done)});const b=Buffer.from(r.digests);terminal=r.terminalStatus>>>0;if(!Number.isSafeInteger(r.boundaryCount)||r.boundaryCount<0||b.length!==r.boundaryCount*96)throw Error("bad batch");if(r.boundaryCount===0&&terminal===0)throw Error("zero-progress batch without terminal status");out.write(b);count+=r.boundaryCount;done+=r.boundaryCount;if(terminal)break;}const replay=bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength);const second=await c.call("snapshot-restore-import",{snapshot:replay},[replay]);if(second.status!==9)throw Error("second snapshot restore was not bounded");out.write(frame("CDRM3END",count,0,terminal));await new Promise(r=>out.end(r));if(terminal||count!==slots+1)throw Error("early terminal");} finally {out.destroy();await worker.terminate();}
