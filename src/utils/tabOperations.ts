// 标签页操作工具函数

// 滚动到底部
export const scrollToBottom = async (tabId: string, scrollbarRefs: Record<string, any>) => {
  // We need to import nextTick here, but since we can't import in a utility file,
  // we'll pass it as a parameter
  const nextTick = (await import('vue')).nextTick;

  await nextTick();
  const scrollbar = scrollbarRefs[tabId];
  if (scrollbar && scrollbar.scrollTo) {
    scrollbar.scrollTo({ top: 999999, behavior: "smooth" });
  }
};

// 导出标签页输出
export const handleExportTab = (tab: { output: string; name: string; }) => {
  const blob = new Blob([tab.output], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${tab.name}-output.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

// 清除标签页输出
export const handleClearTab = (tab: { output: string; }, t: Function) => {
  tab.output = `> ${t("console.cleared")}\n`;
};