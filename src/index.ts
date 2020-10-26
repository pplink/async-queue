import { Subject } from "rxjs";
import { first, filter } from "rxjs/operators";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Result = any;

class AsyncQueue {
  private result$ = new Subject<
    [() => Promise<Result>, Result | null, Error | null]
  >();
  private queue: (() => Promise<Result>)[] = [];

  public getLength(): number {
    return this.queue.length;
  }

  public reset() {
    const [runningTask, ...tasksToCancel] = this.queue;
    if (!runningTask) return;
    this.queue = [runningTask];
    tasksToCancel.forEach((task) => {
      this.result$.next([task, null, new Error("Task aborted")]);
    });
  }

  public async run<T>(fn: () => Promise<T>): Promise<T> {
    const shouldStart = this.queue.length === 0;
    this.queue.push(fn);
    if (shouldStart) this.startNext();

    const resultArray = await this.result$
      .pipe(
        filter(([_fn]) => _fn === fn),
        first()
      )
      .toPromise();
    const error = resultArray[2];
    if (error) throw error;
    const result = resultArray[1];
    return result;
  }

  private startNext(): void {
    const nextTask = this.queue[0];
    if (!nextTask) return;

    nextTask()
      .then((result) => {
        this.queue.shift();
        this.result$.next([nextTask, result, null]);
        this.startNext();
      })
      .catch((e) => {
        this.queue.shift();
        this.result$.next([nextTask, null, e]);
        this.startNext();
      });
  }
}

export default AsyncQueue;
