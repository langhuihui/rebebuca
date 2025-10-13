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
    subtitle: 'Manage your run configurations',
  },
  sidebar: {
    newConfig: 'New Configuration',
  },
  welcome: {
    title: 'Welcome to Rebebuca',
    description: 'A powerful run configuration management tool to help you quickly execute and manage various commands and scripts.',
    quickStart: {
      title: '🚀 Quick Start',
      description: 'Click the "New" button on the left to create your first run configuration',
    },
    efficientExecution: {
      title: '⚡ Efficient Execution',
      description: 'Run commands with one click and view output in real-time',
    },
    configManagement: {
      title: '📝 Configuration Management',
      description: 'Support advanced configurations like working directory and environment variables',
    },
    history: {
      title: '🕒 History',
      description: 'Automatically save run history for repeated execution',
    },
  },
  tab: {
    restart: 'Restart',
    stop: 'Stop',
    export: 'Export',
    clear: 'Clear',
    history: 'History',
    confirmClose: 'Confirm Close',
    confirmCloseMessage: 'Are you sure you want to close this tab? If the process is running, it will be terminated.',
    confirm: 'Confirm',
    cancel: 'Cancel',
  },
  console: {
    preparing: 'Preparing to run',
    restarting: 'Restarting...',
    stopping: 'Stopping process...',
    stopFailed: 'Failed to stop process',
    restartFailed: 'Failed to restart',
    cleared: 'Console cleared',
    noOutput: 'No output recorded',
  },
  history: {
    title: 'Run History',
    empty: 'No run history',
    clear: 'Clear All',
    confirmClear: 'Confirm Clear',
    confirmClearMessage: 'Are you sure you want to clear all run history? This action cannot be undone.',
    confirm: 'Confirm',
    cancel: 'Cancel',
    historyRecord: 'History Record',
    config: 'Configuration',
    command: 'Command',
    time: 'Time',
    configNotFound: 'Configuration not found',
    openLogsFolder: 'Open Logs Folder',
  },
  dialog: {
    title: 'Run Configuration',
    configName: 'Configuration Name',
    configNamePlaceholder: 'Please enter configuration name',
    configNameRequired: 'Please enter configuration name',
    program: 'Program',
    programPlaceholder: 'Please enter program path or command',
    programRequired: 'Please enter command',
    workingDirectory: 'Working Directory',
    workingDirectoryPlaceholder: 'Please enter working directory path',
    arguments: 'Command Line Arguments',
    argumentsPlaceholder: 'Please enter argument',
    argumentsTextPlaceholder: 'Enter arguments separated by spaces',
    environment: 'Environment Variables',
    environmentPlaceholder: 'VARIABLE=value',
    variableName: 'Variable Name',
    value: 'Value',
    save: 'Save',
    cancel: 'Cancel',
    selectProgram: 'Select Executable Program',
    selectWorkingDirectory: 'Select Working Directory',
    checkForm: 'Please check form data',
    saveSuccess: 'Configuration saved successfully',
  },
  error: {
    title: 'Error',
    executeCommandFailed: 'Failed to execute command',
  },
};

