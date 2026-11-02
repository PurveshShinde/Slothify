/**
 * Helper function to force a strict timeout on slow API calls.
 * Drops slow responses if an external engine hangs, returning early.
 */
export const withTimeout = <T>(promise: Promise<T>, ms: number, fallbackValue?: T): Promise<T> => {
    let timer: NodeJS.Timeout;
    const timeout = new Promise<T>((resolve, reject) => {
        timer = setTimeout(() => {
            if (fallbackValue !== undefined) {
                resolve(fallbackValue);
            } else {
                reject(new Error(`Request timed out after ${ms}ms`));
            }
        }, ms);
    });

    return Promise.race([promise, timeout]).finally(() => {
        clearTimeout(timer);
    });
};
