export const objectMerge = <T>(...args: (T | Partial<T>)[]): T => Object.assign({}, ...args);
