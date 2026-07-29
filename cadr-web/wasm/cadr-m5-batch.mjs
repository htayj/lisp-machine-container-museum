/* Deterministic M5 boundary publication state machine.  The worker supplies
 * the wasm-facing operations; this module owns only the ordering contract. */
export function m5SlotAdvanceAllowed(state, requiredLifecycle) {
  return state.visibilityInitialized === true && state.lifecycle === requiredLifecycle &&
    state.hidden === false && state.pendingBoundaryDigest === false;
}

export async function runM5DigestBatch({
  clockSlots,
  state,
  runOne,
  metadata,
  outputDigest,
  isFailure,
  collectFailure,
  statusOk,
  statusWaiting,
  waitingLifecycle,
  yieldTurn = async () => {},
  hasDeferredControl = () => false,
}) {
  const rows = [];
  let terminalStatus = statusOk;
  let boundaryPendingHost = false;
  let failure = null;
  let digestStatus = statusOk;
  const appendDigest = async () => {
    const result = await outputDigest();
    if (result === null || result.status !== statusOk) {
      digestStatus = result === null ? null : result.status;
      return false;
    }
    rows.push(result.digests);
    return true;
  };
  while (rows.length < clockSlots) {
    terminalStatus = await runOne();
    const runMeta = metadata();
    if (runMeta === null || runMeta[0] > 1n) {
      return { invalidMetadata: true, boundaryCount: rows.length, terminalStatus,
        boundaryPendingHost, rows, failure, digestStatus };
    }
    if (isFailure(terminalStatus)) {
      /* A terminal slot never has a normal boundary row.  Collect the
       * failure witness before any digest provider can observe staged data. */
      failure = collectFailure(terminalStatus);
      return { boundaryCount: rows.length, terminalStatus, boundaryPendingHost,
        rows, failure, digestStatus };
    }
    if (runMeta[0] === 0n) {
      if (terminalStatus === statusWaiting) {
        boundaryPendingHost = state.pendingBoundaryDigest;
        state.lifecycle = waitingLifecycle;
        break;
      }
      if (terminalStatus !== statusOk) break;
      if (state.pendingBoundaryDigest) {
        if (!await appendDigest()) break;
        state.pendingBoundaryDigest = false;
        await yieldTurn();
        if (hasDeferredControl()) break;
      }
      continue;
    }
    if (terminalStatus === statusWaiting) {
      state.pendingBoundaryDigest = true;
      boundaryPendingHost = true;
      state.lifecycle = waitingLifecycle;
      break;
    }
    if (terminalStatus !== statusOk) break;
    if (!await appendDigest()) break;
    await yieldTurn();
    if (hasDeferredControl()) break;
  }
  return { boundaryCount: rows.length, terminalStatus, boundaryPendingHost, rows, failure,
    digestStatus };
}
