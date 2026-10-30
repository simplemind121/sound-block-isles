/**
 * 使用时长：页面可见时每秒计时，按天累计到存档；连续玩满设定分钟数就触发温和的休息提醒。
 * 提醒后如果孩子选择继续，5 分钟后再提醒一次。
 */
export class SessionTimer {
  private sessionSec = 0;
  private pending = 0;
  private nextRemindAt: number;
  private handle: number | undefined;

  constructor(
    private minutes: () => number,
    private onUsage: (sec: number) => void,
    private onRest: () => void,
  ) {
    this.nextRemindAt = this.minutes() * 60;
  }

  start(): void {
    if (this.handle !== undefined) return;
    this.handle = setInterval(() => this.tick(), 1000) as unknown as number;
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.flush();
    });
    window.addEventListener('pagehide', () => this.flush());
  }

  tick(): void {
    if (typeof document !== 'undefined' && document.hidden) return;
    this.sessionSec++;
    this.pending++;
    if (this.pending >= 10) this.flush();
    if (this.sessionSec >= this.nextRemindAt) {
      this.nextRemindAt = this.sessionSec + 5 * 60;
      this.onRest();
    }
  }

  flush(): void {
    if (this.pending > 0) this.onUsage(this.pending);
    this.pending = 0;
  }

  /** 休息过了：重新开始计一轮 */
  restart(): void {
    this.sessionSec = 0;
    this.nextRemindAt = this.minutes() * 60;
  }

  get seconds(): number {
    return this.sessionSec;
  }
}
