// 对话框操作工具函数

// 显示确认清除历史记录对话框
export const showClearHistoryDialog = (dialog: any, t: Function, runConfigStore: any, forceThemeOnFloatingComponents: Function, effectiveTheme: string, nextTick: Function) => {
  dialog.warning({
    title: t("history.confirmClear"),
    content: t("history.confirmClearMessage"),
    positiveText: t("history.confirm"),
    negativeText: t("history.cancel"),
    onPositiveClick: async () => {
      await runConfigStore.clearHistory();
    },
  });

  // Force dialog background color after a short delay
  setTimeout(() => {
    forceThemeOnFloatingComponents(effectiveTheme, nextTick);
  }, 100);
};

// 显示确认关闭标签页对话框
export const showCloseTabDialog = (dialog: any, t: Function, closeTab: Function, resetClosingFlag: Function) => {
  dialog.warning({
    title: t("tab.confirmClose"),
    content: t("tab.confirmCloseMessage"),
    positiveText: t("tab.confirm"),
    negativeText: t("tab.cancel"),
    onPositiveClick: closeTab,
    onNegativeClick: () => {
      // Reset closing flag when user cancels
      resetClosingFlag();
    },
    onClose: () => {
      // Reset closing flag when dialog is closed
      resetClosingFlag();
    },
  });
};