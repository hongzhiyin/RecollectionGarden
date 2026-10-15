import { afterEach, expect, it, vi } from 'vitest';
import { installFrameFallback, type FrameHost } from '../../src/pdf/frameFallback';

afterEach(() => vi.useRealTimers());

function suspendedFrames() {
  vi.useFakeTimers();
  let next = 0;
  const callbacks = new Map<number, FrameRequestCallback>();
  const host: FrameHost = {
    requestAnimationFrame: callback => { const id = next++; callbacks.set(id, callback); return id; },
    cancelAnimationFrame: id => { callbacks.delete(id); },
    setTimeout: (callback, delay) => setTimeout(callback, delay) as unknown as number,
    clearTimeout: id => clearTimeout(id), performance: { now: () => 123 },
  };
  installFrameFallback(host);
  return { host, callbacks };
}

it('暂停原生动画帧时仍可完成连续渲染步骤，迟到帧不重复执行', () => {
  const { host, callbacks } = suspendedFrames();
  const completed = vi.fn();
  const id = host.requestAnimationFrame(() => host.requestAnimationFrame(completed));
  const late = callbacks.get(id)!;
  vi.advanceTimersByTime(100);
  expect(completed).toHaveBeenCalledExactlyOnceWith(123);
  late(200);
  expect(completed).toHaveBeenCalledTimes(1);
  expect(callbacks.size).toBe(0); expect(vi.getTimerCount()).toBe(0);
});

it('正常帧优先执行并取消回退，保留原生时间戳和取消语义', () => {
  const { host, callbacks } = suspendedFrames();
  const completed = vi.fn();
  const id = host.requestAnimationFrame(completed);
  callbacks.get(id)!(10);
  vi.advanceTimersByTime(100);
  expect(completed).toHaveBeenCalledExactlyOnceWith(10);
  const cancelled = vi.fn();
  const cancelledId = host.requestAnimationFrame(cancelled);
  const late = callbacks.get(cancelledId)!;
  host.cancelAnimationFrame(cancelledId); late(20);
  vi.advanceTimersByTime(100);
  expect(cancelled).not.toHaveBeenCalled();
  expect(callbacks.size).toBe(0); expect(vi.getTimerCount()).toBe(0);
});
