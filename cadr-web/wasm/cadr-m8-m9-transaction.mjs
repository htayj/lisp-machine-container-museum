/*
 * Final commit gate for one M8/M9 worker/core delivery transaction.
 *
 * A post-preflight core failure cannot be rolled back inside the guest IOB.
 * The only safe outcome is fail-stop: no host-controller commit is reported,
 * both host controllers become inaccessible, and the worker cannot continue.
 */
export function commitCadrM8M9CoreDelivery({ delivery, commit, failClosed } = {}) {
  if (typeof commit !== "function" || typeof failClosed !== "function") {
    throw new TypeError("C-M8/M9 transaction: commit and failClosed callbacks are required");
  }
  if (delivery === null) {
    failClosed();
    throw new Error("C-M8/M9 core delivery violated a successful preflight");
  }
  return commit(delivery);
}
