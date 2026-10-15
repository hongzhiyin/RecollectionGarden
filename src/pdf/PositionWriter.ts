import type { ReaderLocation } from '../library/model';

export class PositionWriter {
  private desired?: ReaderLocation;
  private timer?: ReturnType<typeof setTimeout>;
  private active?: Promise<void>;
  private lastCapture = '';

  constructor(private save: (location: ReaderLocation) => Promise<void>, private status: (text: string) => void,
    private delay = 250) {}

  capture(location: ReaderLocation) {
    const key = JSON.stringify(location);
    if (key === this.lastCapture) return;
    this.lastCapture = key;
    this.desired = structuredClone(location);
    this.status('阅读位置待保存');
    this.cancelTimer();
    this.timer = setTimeout(() => { void this.flush().catch(() => {}); }, this.delay);
  }

  cancelTimer() { if (this.timer) clearTimeout(this.timer); this.timer = undefined; }

  flush(): Promise<void> {
    this.cancelTimer();
    if (this.active) return this.active;
    if (!this.desired) return Promise.resolve();
    const operation = this.write();
    this.active = operation;
    void operation.then(() => {
      this.active = undefined;
      if (this.desired) void this.flush().catch(() => {});
    }, () => { this.active = undefined; });
    return operation;
  }

  private async write() {
    this.status('正在保存阅读位置');
    while (this.desired) {
      const location = this.desired;
      this.desired = undefined;
      try { await this.save(location); }
      catch (error) {
        this.desired ??= location;
        this.status('阅读位置保存失败，请重试');
        throw error;
      }
    }
    this.status('阅读位置已保存');
  }
}
