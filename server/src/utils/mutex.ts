export class Mutex {
  private queue: Array<() => void> = [];
  private isLocked = false;

  async acquire(): Promise<void> {
    if (!this.isLocked) {
      this.isLocked = true;
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      this.queue.push(resolve);
    });
  }

  release(): void {
    if (this.queue.length > 0) {
      const next = this.queue.shift();
      if (next) next();
    } else {
      this.isLocked = false;
    }
  }
}