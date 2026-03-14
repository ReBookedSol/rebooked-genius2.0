/**
 * Executes a list of tasks with a limited number of concurrent executions.
 *
 * @param items The items to process.
 * @param processor A function that processes an item and returns a promise.
 * @param limit The maximum number of concurrent executions.
 * @returns A promise that resolves when all tasks have completed.
 */
export async function runWithConcurrency<T, R>(
  items: T[],
  processor: (item: T, index: number) => Promise<R>,
  limit: number
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let currentIndex = 0;

  async function executeTask(): Promise<void> {
    while (currentIndex < items.length) {
      const index = currentIndex++;
      const item = items[index];
      try {
        results[index] = await processor(item, index);
      } catch (error) {
        // Propagate error to results
        results[index] = Promise.reject(error) as any;
      }
    }
  }

  const workers = Array.from({ length: Math.min(limit, items.length) }, executeTask);
  await Promise.all(workers);

  return results;
}

/**
 * Retries a task with exponential backoff.
 */
export async function withRetry<T>(
  task: () => Promise<T>,
  retries: number = 3,
  delay: number = 1000
): Promise<T> {
  try {
    return await task();
  } catch (error) {
    if (retries <= 0) throw error;
    await new Promise(resolve => setTimeout(resolve, delay));
    return withRetry(task, retries - 1, delay * 2);
  }
}
