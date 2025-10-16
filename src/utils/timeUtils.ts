// 时间格式化工具函数
export const formatTime = (timestamp: Date | number) => {
  const date = typeof timestamp === "number" ? new Date(timestamp) : timestamp;
  return date.toLocaleTimeString();
};