/*
 * Bounded Chrome DevTools Protocol request client.
 *
 * Browser campaigns use a fixed overall deadline.  A WebSocket closing after
 * a request has been sent must therefore reject that request immediately; a
 * silent peer must be bounded by the time remaining in that same campaign.
 */

function deadlineError() {
  return new Error("C-M10 CDP call exceeded the campaign deadline");
}

function disconnectedError(reason) {
  return new Error(`C-M10 CDP connection ${reason}`);
}

export async function connectBoundedCdp(endpoint, {
  deadline, WebSocketImpl = WebSocket, now = Date.now,
  setTimer = setTimeout, clearTimer = clearTimeout,
} = {}) {
  if (typeof endpoint !== "string" || endpoint.length === 0 ||
      !Number.isSafeInteger(deadline) || typeof WebSocketImpl !== "function" ||
      typeof now !== "function" || typeof setTimer !== "function" ||
      typeof clearTimer !== "function") {
    throw new TypeError("C-M10 CDP client configuration is invalid");
  }
  const socket = new WebSocketImpl(endpoint);
  const pending = new Map();
  let sequence = 0; let terminal = null;

  function rejectAll(error) {
    if (terminal !== null) return;
    terminal = error;
    for (const waiter of pending.values()) {
      clearTimer(waiter.timer); waiter.reject(error);
    }
    pending.clear();
  }

  await new Promise((resolveOpen, rejectOpen) => {
    const openTimer = setTimer(() => {
      const error = deadlineError(); rejectAll(error); rejectOpen(error);
    }, Math.max(0, deadline - now()));
    socket.onopen = () => {
      clearTimer(openTimer);
      if (terminal !== null) return;
      if (deadline - now() <= 0) {
        const error = deadlineError(); rejectAll(error); rejectOpen(error);
        try { socket.close(); } catch {}
        return;
      }
      resolveOpen();
    };
    socket.onerror = () => {
      clearTimer(openTimer);
      const error = disconnectedError("failed before opening");
      rejectAll(error); rejectOpen(error);
    };
    socket.onclose = () => {
      clearTimer(openTimer);
      const error = disconnectedError("closed before opening");
      rejectAll(error); rejectOpen(error);
    };
  });

  socket.onmessage = event => {
    let message;
    try { message = JSON.parse(event.data); }
    catch {
      rejectAll(disconnectedError("sent malformed JSON"));
      try { socket.close(); } catch {}
      return;
    }
    const waiter = pending.get(message.id);
    if (waiter === undefined) return;
    pending.delete(message.id); clearTimer(waiter.timer);
    if (message.error) waiter.reject(new Error(message.error.message));
    else waiter.resolve(message.result);
  };
  socket.onerror = () => rejectAll(disconnectedError("failed"));
  socket.onclose = () => rejectAll(disconnectedError("closed"));

  return Object.freeze({
    call(method, params = {}) {
      if (terminal !== null) return Promise.reject(terminal);
      const remaining = deadline - now();
      if (remaining <= 0) {
        const error = deadlineError(); rejectAll(error);
        return Promise.reject(error);
      }
      const id = ++sequence;
      return new Promise((resolveCall, rejectCall) => {
        const timer = setTimer(() => rejectAll(deadlineError()), remaining);
        pending.set(id, { resolve: resolveCall, reject: rejectCall, timer });
        try { socket.send(JSON.stringify({ id, method, params })); }
        catch (error) {
          const waiter = pending.get(id);
          if (waiter !== undefined) {
            pending.delete(id); clearTimer(waiter.timer); waiter.reject(error);
          }
          rejectAll(error);
        }
      });
    },
    close() {
      rejectAll(disconnectedError("closed by its caller"));
      try { socket.close(); } catch {}
    },
  });
}
