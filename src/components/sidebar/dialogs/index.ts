/**
 * Rebebuca
 * Copyright (C) 2025 rebebuca contributors
 * 
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

export { default as TaskEditDialog } from './TaskEditDialog.vue';
export { default as AddFolderDialog } from './AddFolderDialog.vue';
export { default as TaskSelectionDialog } from './TaskSelectionDialog.vue';
export { default as RenameGroupDialog } from './RenameGroupDialog.vue';
export { default as CommandPlazaDialog } from './CommandPlazaDialog.vue';
export { default as AICollabCreateDialog } from './AICollabCreateDialog.vue';
export { default as AICollabEditDialog } from './AICollabEditDialog.vue';
export { default as RemoteDirectoryPicker } from './RemoteDirectoryPicker.vue';

import type { AIToolType } from '../../../stores/aiTools';

// Re-export types inline
export interface AddFolderFormData {
  sourceFolder: string;
  isImportMode: boolean;
  targetGroupId: string;
  newGroupName: string;
}

export interface AICollabFormData {
  projectPath: string;
  sessionName: string;
  supervisorType: 'ai-tool' | 'custom-cli';
  supervisorAITool?: AIToolType;
  supervisorCommand?: string;
  workerType: 'ai-tool' | 'custom-cli';
  workerAITool?: AIToolType;
  workerCommand?: string;
  decisionTimeout: number;
  envVars: string;
  groupId?: string;
  newGroupName?: string;
}

export interface AICollabEditFormData {
  taskId: string;
  projectPath: string;
  sessionName: string;
  supervisorType: 'ai-tool' | 'custom-cli';
  supervisorAITool?: AIToolType;
  supervisorCommand?: string;
  workerType: 'ai-tool' | 'custom-cli';
  workerAITool?: AIToolType;
  workerCommand?: string;
  decisionTimeout: number;
  envVars: string;
  sessionId?: string;
}
