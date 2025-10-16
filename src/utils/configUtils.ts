// 配置操作工具函数

// 处理配置保存
export const handleConfigSaved = async (
  configData: any,
  editingConfig: { value: any; },
  runConfigStore: any,
  resetEditingState: Function
) => {
  try {
    if (editingConfig.value) {
      await runConfigStore.updateConfig(editingConfig.value.id, configData);
    } else {
      await runConfigStore.addConfig(configData);
    }
    resetEditingState();
  } catch (error) {
    console.error("Failed to save config:", error);
  }
};

// 编辑配置
export const handleEditConfig = (config: any, editingConfig: { value: any; }, showConfigDialog: { value: boolean; }) => {
  editingConfig.value = { ...config };
  showConfigDialog.value = true;
};

// 创建新配置
export const handleNewConfig = (editingConfig: { value: any; }, showConfigDialog: { value: boolean; }) => {
  editingConfig.value = null;
  showConfigDialog.value = true;
};

// 运行配置
export const handleRunConfig = async (config: any, runConfigStore: any, addTab: Function) => {
  try {
    // Execute command and get process ID and history ID
    const { processId, historyId } = await runConfigStore.executeCommand(
      config
    );

    // Add tab with process ID and history ID
    addTab(config, processId, historyId);
  } catch (error) {
    console.error("Failed to execute command:", error);
  }
};