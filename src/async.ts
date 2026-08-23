export function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T | undefined>;
export function withTimeout<T>(promise: Promise<T>, timeoutMs: number, onTimeout: () => T): Promise<T>;
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  onTimeout?: () => T
): Promise<T | undefined> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<T | undefined>((resolve) => {
    timeout = setTimeout(() => resolve(onTimeout?.()), timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}
