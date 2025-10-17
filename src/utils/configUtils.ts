// 配置操作工具函数

import type { Ref } from "vue";

// 保存配置
export const handleConfigSaved = async (
  configData: any,
  editingConfig: Ref<any>,
  runConfigStore: any,
  resetEditingState: () => void
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
export const handleEditConfig = (
  config: any,
  editingConfig: Ref<any>,
  showConfigDialog: Ref<boolean>
) => {
  editingConfig.value = { ...config };
  showConfigDialog.value = true;
};

// 创建新配置
export const handleNewConfig = (
  editingConfig: Ref<any>,
  showConfigDialog: Ref<boolean>
) => {
  editingConfig.value = null;
  showConfigDialog.value = true;
};

// 运行配置
export const handleRunConfig = async (
  config: any,
  runConfigStore: any,
  addTab: Function
) => {
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
