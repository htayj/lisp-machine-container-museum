/*
 * Bounded ownership for detached helper process groups.
 *
 * A detached browser is useful when a campaign must kill that browser without
 * killing its own supervisor.  The corresponding obligation is to retain
 * group ownership across partial launch, ordinary exceptions, and bounded
 * TERM-to-KILL cleanup.
 */
export class CadrProcessGroupSupervisor {
  #children = new Set();
  #groupExists;
  #killGroup;
  #graceMilliseconds;

  constructor({ killGroup = (pid, signal) => process.kill(-pid, signal),
    groupExists = pid => {
      try { process.kill(-pid, 0); return true; }
      catch (error) {
        if (error?.code === "ESRCH") return false;
        throw error;
      }
    },
    graceMilliseconds = 5000 } = {}) {
    if (typeof killGroup !== "function" || typeof groupExists !== "function" ||
        !Number.isSafeInteger(graceMilliseconds) ||
        graceMilliseconds < 1 || graceMilliseconds > 60000) {
      throw new TypeError("process-group supervisor configuration is invalid");
    }
    this.#killGroup = killGroup;
    this.#groupExists = groupExists;
    this.#graceMilliseconds = graceMilliseconds;
  }

  track(child) {
    if (child === null || typeof child !== "object" ||
        !Number.isSafeInteger(child.pid) || child.pid < 1 ||
        typeof child.once !== "function") {
      throw new TypeError("detached child is invalid");
    }
    this.#children.add(child);
    return child;
  }

  get size() { return this.#children.size; }

  #signal(child, signal) {
    try { this.#killGroup(child.pid, signal); }
    catch (error) {
      if (error?.code === "ESRCH") return false;
      throw error;
    }
    return true;
  }

  async #waitForGroupExit(child) {
    const deadline = Date.now() + this.#graceMilliseconds;
    while (this.#groupExists(child.pid)) {
      if (Date.now() >= deadline) return false;
      await new Promise(resolveWait => setTimeout(resolveWait, 10));
    }
    return true;
  }

  async stop(child, signal = "SIGTERM") {
    if (!this.#children.has(child)) return;
    if (!this.#signal(child, signal)) {
      this.#children.delete(child);
      return;
    }
    if (!await this.#waitForGroupExit(child)) {
      if (signal !== "SIGKILL") {
        this.#signal(child, "SIGKILL");
      }
      if (signal === "SIGKILL" || !await this.#waitForGroupExit(child)) {
        throw new Error("detached process group did not exit after SIGKILL");
      }
    }
    this.#children.delete(child);
  }

  killAll(signal = "SIGKILL") {
    for (const child of this.#children) this.#signal(child, signal);
  }

  async stopAll(signal = "SIGKILL") {
    const failures = [];
    for (const child of [...this.#children]) {
      try { await this.stop(child, signal); }
      catch (error) { failures.push(error); }
    }
    if (failures.length === 1) throw failures[0];
    if (failures.length > 1) {
      throw new AggregateError(failures,
        "detached process-group cleanup failed");
    }
  }
}
