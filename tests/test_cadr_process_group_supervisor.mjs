import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { EventEmitter } from "node:events";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { CadrProcessGroupSupervisor } from
  "../scripts/cadr-process-group-supervisor.mjs";

class FakeChild extends EventEmitter {
  constructor(pid) {
    super(); this.pid = pid; this.exitCode = null; this.signalCode = null;
  }
  close(signal) {
    this.signalCode = signal; this.emit("close", null, signal);
  }
}

{
  const signals = [];
  const child = new FakeChild(101);
  let exists = true;
  const supervisor = new CadrProcessGroupSupervisor({
    graceMilliseconds: 20,
    groupExists() { return exists; },
    killGroup(pid, signal) {
      signals.push([pid, signal]);
      setImmediate(() => { exists = false; child.close(signal); });
    },
  });
  supervisor.track(child);
  await supervisor.stop(child);
  assert.deepEqual(signals, [[101, "SIGTERM"]]);
  assert.equal(supervisor.size, 0);
}

{
  const signals = [];
  const child = new FakeChild(102);
  let exists = true;
  const supervisor = new CadrProcessGroupSupervisor({
    graceMilliseconds: 5,
    groupExists() { return exists; },
    killGroup(pid, signal) {
      signals.push([pid, signal]);
      if (signal === "SIGKILL") {
        setImmediate(() => { exists = false; child.close(signal); });
      }
    },
  });
  supervisor.track(child);
  await supervisor.stop(child);
  assert.deepEqual(signals, [[102, "SIGTERM"], [102, "SIGKILL"]],
    "a stalled detached group is escalated after the bounded grace interval");
  assert.equal(supervisor.size, 0);
}

{
  const children = [new FakeChild(103), new FakeChild(104)];
  const live = new Set(children.map(child => child.pid));
  const signals = [];
  const supervisor = new CadrProcessGroupSupervisor({
    graceMilliseconds: 20,
    groupExists(pid) { return live.has(pid); },
    killGroup(pid, signal) {
      signals.push([pid, signal]);
      setImmediate(() => {
        live.delete(pid);
        children.find(child => child.pid === pid).close(signal);
      });
    },
  });
  children.forEach(child => supervisor.track(child));
  await supervisor.stopAll("SIGKILL");
  assert.deepEqual(signals, [[103, "SIGKILL"], [104, "SIGKILL"]]);
  assert.equal(supervisor.size, 0);
}

{
  const child = new FakeChild(105);
  const supervisor = new CadrProcessGroupSupervisor({
    graceMilliseconds: 5,
    groupExists() { return true; },
    killGroup() {},
  });
  supervisor.track(child);
  await assert.rejects(supervisor.stop(child, "SIGKILL"),
    /did not exit after SIGKILL/,
    "a non-exiting group must not be forgotten after the final signal");
  assert.equal(supervisor.size, 1);
}

{
  const child = new FakeChild(106);
  child.close("SIGTERM");
  let exists = true;
  const signals = [];
  const supervisor = new CadrProcessGroupSupervisor({
    graceMilliseconds: 5,
    groupExists() { return exists; },
    killGroup(pid, signal) {
      signals.push([pid, signal]);
      if (signal === "SIGKILL") setImmediate(() => { exists = false; });
    },
  });
  supervisor.track(child);
  await supervisor.stopAll();
  assert.deepEqual(signals, [[106, "SIGKILL"]],
    "ownership and cleanup survive an unexpected leader close");
  assert.equal(supervisor.size, 0);
}

{
  const child = new FakeChild(107);
  child.close("SIGTERM");
  let exists = true;
  const signals = [];
  const supervisor = new CadrProcessGroupSupervisor({
    graceMilliseconds: 5,
    groupExists() { return exists; },
    killGroup(pid, signal) {
      signals.push([pid, signal]);
      if (signal === "SIGKILL") setImmediate(() => { exists = false; });
    },
  });
  supervisor.track(child);
  await supervisor.stop(child, "SIGTERM");
  assert.deepEqual(signals, [[107, "SIGTERM"], [107, "SIGKILL"]],
    "a closed leader does not hide a descendant that ignores SIGTERM");
  assert.equal(supervisor.size, 0);
}

{
  const helper = resolve(import.meta.dirname, "../scripts/cadr-pdeath-exec.py");
  const child = spawn("/usr/bin/python3", [
    helper, String(process.pid), "/bin/sh", "-c",
    "trap '' TERM; echo ready >&2; while :; do sleep 30; done",
  ], { detached: true, stdio: ["ignore", "ignore", "pipe"] });
  await new Promise((resolveReady, rejectReady) => {
    let text = "";
    child.once("error", rejectReady);
    child.stderr.on("data", block => {
      text += block.toString("utf8");
      if (text.includes("ready\n")) resolveReady();
    });
  });
  const supervisor = new CadrProcessGroupSupervisor({
    graceMilliseconds: 100,
  });
  supervisor.track(child);
  const started = Date.now();
  await supervisor.stop(child, "SIGTERM");
  const elapsed = Date.now() - started;
  assert.equal(elapsed >= 80, true,
    "ordinary SIGTERM receives its bounded grace before SIGKILL escalation");
  assert.throws(() => process.kill(-child.pid, 0),
    error => error?.code === "ESRCH",
    "the escalated live wrapper test leaves no process group");
}

{
  const helper = resolve(import.meta.dirname, "../scripts/cadr-pdeath-exec.py");
  const program = `
    const {spawn}=require("node:child_process");
    const {readFileSync}=require("node:fs");
    const child=spawn("/usr/bin/python3",
      [${JSON.stringify(helper)}, String(process.pid), "/bin/sh", "-c",
       "sleep 30 & wait"],
      {detached:true,stdio:"ignore"});
    let descendant=null;
    for(let attempt=0;attempt<100;attempt+=1){
      try{
        const children=readFileSync("/proc/"+child.pid+"/task/"+
          child.pid+"/children","utf8").trim().split(/ +/).filter(Boolean);
        if(children.length){descendant=Number(children[0]);break;}
      }catch{}
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,10);
    }
    if(descendant===null)process.exit(2);
    process.stdout.write(JSON.stringify({leader:child.pid,descendant}));
    child.unref();
  `;
  const supervisor = spawn(process.execPath, ["-e", program], {
    stdio: ["ignore", "pipe", "inherit"],
  });
  const blocks = [];
  supervisor.stdout.on("data", block => blocks.push(block));
  await new Promise((resolveClose, rejectClose) => {
    supervisor.once("error", rejectClose);
    supervisor.once("close", resolveClose);
  });
  const pids = Object.values(JSON.parse(Buffer.concat(blocks).toString("ascii")));
  assert.equal(pids.every(Number.isSafeInteger), true);
  for (const pid of pids) {
    let exited = false;
    for (let attempt = 0; attempt < 50; attempt += 1) {
      try {
        const state = (await readFile(`/proc/${pid}/stat`, "utf8"))
          .split(" ")[2];
        if (state === "Z") { exited = true; break; }
      } catch (error) {
        if (error?.code === "ENOENT") { exited = true; break; }
        throw error;
      }
      await new Promise(resolveDelay => setTimeout(resolveDelay, 10));
    }
    assert.equal(exited, true,
      "PDEATHSIG kills the group leader and its descendants");
  }
  let groupExited = false;
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try { process.kill(-pids[0], 0); }
    catch (error) {
      if (error?.code === "ESRCH") { groupExited = true; break; }
      throw error;
    }
    await new Promise(resolveDelay => setTimeout(resolveDelay, 10));
  }
  assert.equal(groupExited, true,
    "no unenumerated descendant remains in the detached process group");
}

console.log("CADR detached process-group supervision tests passed");
