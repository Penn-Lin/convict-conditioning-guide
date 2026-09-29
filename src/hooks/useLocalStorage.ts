/**
 * 通用 `localStorage` 持久化 hook（架构 §2.3 T02）。
 *
 * 特性：
 * - SSR 安全：`typeof window === 'undefined'` 时不做任何读写，直接使用初值。
 * - 读写容错：`getItem` / `JSON.parse` / `setItem` 全部包裹 try/catch，
 *   在隐私模式、配额超限、脏数据等场景下静默降级，绝不抛异常。
 * - 支持函数式更新（与 `useState` 一致）。
 *
 * @param key           持久化键
 * @param initialValue  读取失败或不存在时的初值
 * @returns `[value, setValue]` 元组
 */
import { useCallback, useState } from 'react';

export function useLocalStorage<T>(
  key: string,
  initialValue: T,
): [T, (value: T | ((prev: T) => T)) => void] {
  const [storedValue, setStoredValue] = useState<T>(() => {
    if (typeof window === 'undefined') return initialValue;
    try {
      const raw = window.localStorage.getItem(key);
      return raw === null ? initialValue : (JSON.parse(raw) as T);
    } catch {
      // 隐私模式 / 脏数据：安全回退到初值。
      return initialValue;
    }
  });

  const setValue = useCallback(
    (value: T | ((prev: T) => T)) => {
      setStoredValue((prev) => {
        const next =
          typeof value === 'function' ? (value as (p: T) => T)(prev) : value;
        try {
          if (typeof window !== 'undefined') {
            window.localStorage.setItem(key, JSON.stringify(next));
          }
        } catch {
          // 写入失败不阻塞 UI，仅内存态生效。
        }
        return next;
      });
    },
    [key],
  );

  return [storedValue, setValue];
}
