/**
 * TrainingProvider —— 全站共享同一个训练状态实例。
 *
 * 为什么需要 Provider：`useTrainingState` 内部用 `useState` 持有状态，
 * 若首页与某个子组件各调一次，就会各自持有一份 —— 一处完成打卡，另一处不会更新。
 * 把实例提到布局层共享，是这类「本地状态即全局状态」应用最省事也最不容易出错的写法。
 */
import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';
import { useTrainingState } from '@/hooks/useTrainingState';
import type { UseTrainingStateResult } from '@/hooks/useTrainingState';

const TrainingContext = createContext<UseTrainingStateResult | null>(null);

/**
 * 训练状态 Provider。
 *
 * @example
 * <TrainingProvider><Outlet /></TrainingProvider>
 */
export function TrainingProvider({ children }: { children: ReactNode }) {
  const value = useTrainingState();
  return <TrainingContext.Provider value={value}>{children}</TrainingContext.Provider>;
}

/** 取共享的训练状态（必须在 `TrainingProvider` 内使用） */
export function useTraining(): UseTrainingStateResult {
  const ctx = useContext(TrainingContext);
  if (ctx === null) {
    throw new Error('useTraining 必须在 <TrainingProvider> 内使用');
  }
  return ctx;
}
