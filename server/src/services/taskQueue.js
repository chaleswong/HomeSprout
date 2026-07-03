/**
 * 串行任务队列
 * 控制并发数为 1，确保文件处理按顺序执行，避免资源竞争
 */
export class TaskQueue {
  constructor(concurrency = 1) {
    this._concurrency = concurrency;
    this._queue = [];
    this._running = 0;
  }

  /**
   * 当前等待中的任务数
   */
  get pending() {
    return this._queue.length;
  }

  /**
   * 当前正在执行的任务数
   */
  get active() {
    return this._running;
  }

  /**
   * 添加任务到队列
   * @param {Function} taskFn - 返回 Promise 的异步任务函数
   * @returns {Promise} 任务完成时 resolve
   */
  add(taskFn) {
    return new Promise((resolve, reject) => {
      this._queue.push({ taskFn, resolve, reject });
      this._process();
    });
  }

  /**
   * 内部队列处理逻辑
   * 当运行中的任务数小于并发限制时，取出下一个任务执行
   */
  async _process() {
    if (this._running >= this._concurrency || this._queue.length === 0) {
      return;
    }

    const { taskFn, resolve, reject } = this._queue.shift();
    this._running++;

    try {
      const result = await taskFn();
      resolve(result);
    } catch (error) {
      reject(error);
    } finally {
      this._running--;
      // 处理完当前任务后继续处理队列中的下一个
      this._process();
    }
  }
}
