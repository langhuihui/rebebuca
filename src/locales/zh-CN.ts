/**
 * Rebebuca
 * Copyright (C) 2025 rebebuca contributors
 * 
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 * 
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 * 
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

export default {
  app: {
    title: 'Rebebuca',
    subtitle: '管理你的运行配置',
  },
  sidebar: {
    newConfig: '新建配置',
  },
  welcome: {
    title: '欢迎使用 Rebebuca',
    description: '一个强大的运行配置管理工具，帮助你快速执行和管理各种命令和脚本。',
    quickStart: {
      title: '🚀 快速开始',
      description: '点击左侧的"新建"按钮创建你的第一个运行配置',
    },
    efficientExecution: {
      title: '⚡ 高效执行',
      description: '一键运行命令，实时查看输出结果',
    },
    configManagement: {
      title: '📝 配置管理',
      description: '支持工作目录、环境变量等高级配置',
    },
    history: {
      title: '🕒 历史记录',
      description: '自动保存运行历史，方便重复执行',
    },
  },
  tab: {
    restart: '重新运行',
    stop: '停止',
    export: '导出',
    clear: '清空',
    history: '历史',
  },
  console: {
    preparing: '准备运行',
    restarting: '重新运行...',
    stopping: '正在停止进程...',
    stopFailed: '停止进程失败',
    restartFailed: '重启失败',
    cleared: '控制台已清空',
    noOutput: '暂无输出记录',
  },
  history: {
    title: '运行历史',
    empty: '暂无运行历史',
    clear: '清空',
    confirmClear: '确认清空',
    confirmClearMessage: '确定要清空所有运行历史吗？此操作不可撤销。',
    confirm: '确定',
    cancel: '取消',
    historyRecord: '历史记录',
    config: '配置',
    command: '命令',
    time: '时间',
    configNotFound: '找不到对应的运行配置',
  },
  dialog: {
    title: '运行配置',
    configName: '配置名称',
    configNamePlaceholder: '请输入配置名称',
    configNameRequired: '请输入配置名称',
    program: '执行程序',
    programPlaceholder: '请输入程序路径或命令',
    programRequired: '请输入执行命令',
    workingDirectory: '工作目录',
    workingDirectoryPlaceholder: '请输入工作目录路径',
    arguments: '命令行参数',
    argumentsPlaceholder: '请输入参数',
    argumentsTextPlaceholder: '请输入参数，用空格分隔',
    environment: '环境变量',
    environmentPlaceholder: '变量名=值',
    variableName: '变量名',
    value: '值',
    save: '保存',
    cancel: '取消',
    selectProgram: '选择可执行程序',
    selectWorkingDirectory: '选择工作目录',
    checkForm: '请检查表单数据',
    saveSuccess: '配置保存成功',
  },
  error: {
    title: '错误',
    executeCommandFailed: '执行命令失败',
  },
};

