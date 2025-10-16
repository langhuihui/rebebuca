// 历史记录工具函数

// 修复 removeHistory 方法调用
export const removeHistoryItem = async (index: number, runConfigStore: any) => {
  await runConfigStore.removeHistory(index);
};