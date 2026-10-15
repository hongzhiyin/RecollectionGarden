import { describe, expect, it, vi } from 'vitest';
import { PositionWriter } from '../../src/pdf/PositionWriter';
import type { ReaderLocation } from '../../src/library/model';

const location = (page: number): ReaderLocation => ({ page, zoom: { mode: 'percent', percent: 150 }, offsetX: 0.2, offsetY: 0.6 });

describe('阅读位置写入队列', () => {
  it('关闭前主动提交，不需要等待自动保存延迟', async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const writer = new PositionWriter(save, () => {}, 60_000);
    writer.capture(location(2)); await writer.flush();
    expect(save).toHaveBeenCalledExactlyOnceWith(location(2));
  });
  it('旧写入完成后提交最新位置，忽略未提交的中间位置', async () => {
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    const positions: number[] = [];
    const writer = new PositionWriter(async next => { positions.push(next.page); if (positions.length === 1) await gate; }, () => {}, 60_000);
    writer.capture(location(1)); const flush = writer.flush();
    writer.capture(location(2)); writer.capture(location(3)); release();
    await flush; writer.cancelTimer();
    expect(positions).toEqual([1, 3]);
  });
  it('失败保留最新快照，重试不会退回旧位置', async () => {
    const statuses: string[] = [];
    const save = vi.fn().mockRejectedValueOnce(new Error('quota')).mockResolvedValue(undefined);
    const writer = new PositionWriter(save, status => statuses.push(status), 60_000);
    writer.capture(location(1)); await expect(writer.flush()).rejects.toThrow();
    writer.capture(location(3)); await writer.flush();
    expect(save.mock.calls.map(call => call[0].page)).toEqual([1, 3]);
    expect(statuses).toContain('阅读位置保存失败，请重试');
    expect(statuses.at(-1)).toBe('阅读位置已保存');
  });
});
