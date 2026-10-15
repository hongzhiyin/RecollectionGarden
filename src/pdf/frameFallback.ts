export interface FrameHost {
  requestAnimationFrame: (callback: FrameRequestCallback) => number;
  cancelAnimationFrame: (id: number) => void;
  setTimeout: (callback: () => void, delay: number) => number;
  clearTimeout: (id: number) => void;
  performance: { now: () => number };
}

// Display rendering must complete even when the host suspends repaint callbacks.
// Race each native frame with a one-shot timer; idle readers schedule no work.
export function installFrameFallback(host: FrameHost, delay = 50) {
  const request = host.requestAnimationFrame.bind(host);
  const cancel = host.cancelAnimationFrame.bind(host);
  const pending = new Map<number, number>();
  host.requestAnimationFrame = callback => {
    const finish = (timestamp: number) => {
      const timer = pending.get(id);
      if (timer === undefined) return;
      pending.delete(id); host.clearTimeout(timer); cancel(id);
      callback.call(host, timestamp);
    };
    const id = request(finish);
    pending.set(id, host.setTimeout(() => finish(host.performance.now()), delay));
    return id;
  };
  host.cancelAnimationFrame = id => {
    const timer = pending.get(id);
    if (timer !== undefined) { pending.delete(id); host.clearTimeout(timer); }
    cancel(id);
  };
}
