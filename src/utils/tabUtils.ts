// 标签页状态颜色工具函数
export const getTabStatusColor = (tab: { hasError: boolean; status: string; }) => {
  // If tab has error output, always show red
  if (tab.hasError) {
    return "#ef4444"; // Red
  }

  switch (tab.status) {
    case "running":
      return "#00d084"; // Green
    case "success":
      return "#3b82f6"; // Blue
    case "error":
      return "#ef4444"; // Red
    default:
      return "#6b7280"; // Gray
  }
};

// 历史记录状态颜色工具函数
export const getHistoryStatusColor = (historyItem: { output?: string; status?: string; }) => {
  // Check if output contains [ERROR] prefix
  const hasErrorOutput =
    historyItem.output && historyItem.output.includes("[ERROR]");

  if (hasErrorOutput || historyItem.status === "error") {
    return "#ef4444"; // Red
  }

  switch (historyItem.status) {
    case "running":
      return "#00d084"; // Green
    case "success":
      return "#3b82f6"; // Blue
    default:
      return "#6b7280"; // Gray
  }
};

// 获取标签页命令显示文本
export const getTabCommand = (tab: { configId?: string; }, getConfig: (id: string) => any) => {
  if (tab.configId) {
    const config = getConfig(tab.configId);
    if (config) {
      const args =
        config.arguments && config.arguments.length > 0
          ? " " +
          config.arguments
            .map((arg: string) => {
              // Quote arguments that contain spaces
              return arg.includes(" ") ? `"${arg}"` : arg;
            })
            .join(" ")
          : "";
      return `${config.command}${args}`;
    }
  }
  return "";
};