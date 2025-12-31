<!--
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
 -->

<template>
  <n-layout-sider
    v-show="uiStore.sidebarVisible"
    bordered
    :width="280"
    class="sidebar-layout"
  >
    <div class="sidebar-container">
      <!-- Header -->
      <div class="task-header-container">
        <div class="task-header-content">
          <div class="header-row">
            <!-- Logo with version -->
            <div class="logo-version">
              <img
                :src="effectiveTheme === 'light' ? '/logo.svg' : '/logo-dark.svg'"
                alt="Logo"
                class="logo-image"
              />
              <span class="version-text">v{{ currentVersion }}</span>
              <n-tooltip v-if="updaterStore.updateAvailable" trigger="hover">
                <template #trigger>
                  <span class="update-indicator" @click="handleShowUpdateDialog">
                    <n-icon size="14">
                      <component :is="svgIcons.refresh" />
                    </n-icon>
                  </span>
                </template>
                {{ t('settings.updateAvailable') }}: v{{ updaterStore.updateInfo?.version }}
              </n-tooltip>
            </div>
            <!-- Action buttons -->
            <n-space :size="4">
              <!-- Add folder button (open or import) -->
              <n-tooltip trigger="hover">
                <template #trigger>
                  <n-button
                    size="small"
                    quaternary
                    @click="handleAddFolder"
                  >
                    <template #icon>
                      <n-icon size="16">
                        <component :is="svgIcons.folderPlus" />
                      </n-icon>
                    </template>
                  </n-button>
                </template>
                {{ t('task.addFolder') }}
              </n-tooltip>
              
              <!-- Add task button -->
              <n-tooltip trigger="hover">
                <template #trigger>
                  <n-button
                    size="small"
                    quaternary
                    @click="handleAddTask"
                  >
                    <template #icon>
                      <n-icon size="16">
                        <component :is="svgIcons.plus" />
                      </n-icon>
                    </template>
                  </n-button>
                </template>
                {{ t('task.addTask') }}
              </n-tooltip>
              
              <!-- AI Generate button -->
              <n-tooltip trigger="hover">
                <template #trigger>
                  <n-button
                    size="small"
                    quaternary
                    @click="showAIDialog = true"
                  >
                    <template #icon>
                      <n-icon size="16">
                        <component :is="svgIcons.ai" />
                      </n-icon>
                    </template>
                  </n-button>
                </template>
                {{ t('task.aiGenerate') }}
              </n-tooltip>
            </n-space>
          </div>
        </div>
      </div>
      
      <!-- Task tree -->
      <div class="task-tree-container">
        <n-scrollbar>
          <!-- Empty state -->
          <div v-if="taskManager.combinedTasks.length === 0 && !taskManager.isScanning" class="empty-state">
            <n-icon size="48" :depth="3">
              <component :is="svgIcons.task" />
            </n-icon>
            <p class="empty-text">{{ t('task.noTasks') }}</p>
            <n-button size="small" @click="handleAddFolder">
              {{ t('task.addFolder') }}
            </n-button>
          </div>
          
          <!-- Task tree -->
          <div v-else class="task-tree">
            <!-- Favorites section -->
            <template v-if="taskManager.favoriteTasks.length > 0">
              <div 
                class="tree-node section-node"
                @click="toggleNode('favorites')"
              >
                <n-icon size="14" class="tree-icon expand-icon">
                  <component :is="isExpanded('favorites') ? svgIcons.chevronDown : svgIcons.chevronRight" />
                </n-icon>
                <n-icon size="16" class="tree-icon star-icon">
                  <component :is="svgIcons.star" />
                </n-icon>
                <span class="tree-label section-label">{{ t('task.favorites') }}</span>
                <span class="tree-badge">{{ taskManager.favoriteTasks.length }}</span>
              </div>
              
              <template v-if="isExpanded('favorites')">
                <div
                  v-for="(task, index) in taskManager.favoriteTasks" 
                  :key="`fav-${task.id}`"
                  class="tree-node task-node favorite-task-node"
                  :class="{ 
                    'task-running': taskManager.isTaskRunning(task.id),
                    'drag-over-top': favoriteDragOverIndex === index && favoriteDragPosition === 'top',
                    'drag-over-bottom': favoriteDragOverIndex === index && favoriteDragPosition === 'bottom',
                    'is-dragging': isDraggingFavorite && favoriteDraggedIndex === index
                  }"
                  :title="getFullCommand(task)"
                  @click="handleTaskClick(task)"
                  @mousedown="handleFavoriteMouseDown($event, task, index)"
                >
                  <n-icon size="14" class="tree-icon task-type-icon">
                    <component :is="getTaskIcon(task)" />
                  </n-icon>
                  <span class="tree-label task-label">
                    {{ task.name }}<span v-if="getFavoriteFolderLabel(task)" class="folder-hint">({{ getFavoriteFolderLabel(task) }})</span>
                  </span>
                  <!-- Floating action buttons -->
                  <div class="task-actions-float">
                    <n-button
                      v-if="!taskManager.isTaskRunning(task.id)"
                      size="tiny"
                      quaternary
                      class="action-btn"
                      @click.stop="handleTaskRun(task)"
                    >
                      <template #icon>
                        <n-icon size="12">
                          <component :is="svgIcons.play" />
                        </n-icon>
                      </template>
                    </n-button>
                    <n-button
                      v-if="taskManager.isTaskRunning(task.id)"
                      size="tiny"
                      quaternary
                      class="action-btn stop-btn"
                      @click.stop="handleTaskStop(task)"
                    >
                      <template #icon>
                        <n-icon size="12">
                          <component :is="svgIcons.stop" />
                        </n-icon>
                      </template>
                    </n-button>
                    <n-button
                      v-if="taskManager.isTaskRunning(task.id)"
                      size="tiny"
                      quaternary
                      class="action-btn restart-btn"
                      @click.stop="handleTaskRun(task)"
                    >
                      <template #icon>
                        <n-icon size="12">
                          <component :is="svgIcons.refresh" />
                        </n-icon>
                      </template>
                    </n-button>
                    <n-button
                      size="tiny"
                      quaternary
                      class="action-btn favorite-btn active"
                      @click.stop="handleToggleFavorite(task)"
                    >
                      <template #icon>
                        <n-icon size="12">
                          <component :is="svgIcons.starFilled" />
                        </n-icon>
                      </template>
                    </n-button>
                    <n-button
                      size="tiny"
                      quaternary
                      class="action-btn"
                      @click.stop="handleTaskEditVisual(task)"
                    >
                      <template #icon>
                        <n-icon size="12">
                          <component :is="svgIcons.edit" />
                        </n-icon>
                      </template>
                    </n-button>
                  </div>
                </div>
              </template>
              
              <div class="section-divider"></div>
            </template>
            
            <!-- User groups section -->
            <template v-for="group in taskManager.userGroups" :key="group.id">
              <div 
                class="tree-node group-node"
                :class="{ 'drag-over': dragOverGroupId === group.id }"
                @click="toggleNode(`group:${group.id}`)"
                @dragover.prevent="handleDragOver($event, group.id)"
                @dragleave="handleDragLeave"
                @drop="handleDrop($event, group.id)"
              >
                <n-icon size="14" class="tree-icon expand-icon">
                  <component :is="isExpanded(`group:${group.id}`) ? svgIcons.chevronDown : svgIcons.chevronRight" />
                </n-icon>
                <n-icon size="16" class="tree-icon group-icon">
                  <component :is="svgIcons.task" />
                </n-icon>
                <span class="tree-label">{{ group.name }}</span>
                <span class="tree-badge">{{ group.tasks.length }}</span>
                <div class="group-actions">
                  <n-button
                    size="tiny"
                    quaternary
                    @click.stop="handleRenameGroup(group)"
                  >
                    <template #icon>
                      <n-icon size="14">
                        <component :is="svgIcons.edit" />
                      </n-icon>
                    </template>
                  </n-button>
                  <n-button
                    v-if="group.id !== 'default'"
                    size="tiny"
                    quaternary
                    @click.stop="handleDeleteGroup(group.id)"
                  >
                    <template #icon>
                      <n-icon size="14">
                        <component :is="svgIcons.close" />
                      </n-icon>
                    </template>
                  </n-button>
                </div>
              </div>
              
              <!-- Group tasks -->
              <template v-if="isExpanded(`group:${group.id}`)">
                <n-tooltip
                  v-for="task in group.tasks" 
                  :key="task.id"
                  trigger="hover"
                  placement="right"
                  :delay="500"
                >
                  <template #trigger>
                    <div 
                      class="tree-node task-node group-task-node"
                      :class="{ 'task-running': taskManager.isTaskRunning(task.id) }"
                      draggable="true"
                      @click="handleTaskClick(task)"
                      @dragstart="handleDragStart($event, task)"
                      @dragend="handleDragEnd"
                    >
                      <n-icon size="14" class="tree-icon task-type-icon">
                        <component :is="getTaskIcon(task)" />
                      </n-icon>
                      <span class="tree-label task-label">{{ task.name }}</span>
                      <!-- Floating action buttons -->
                      <div class="task-actions-float">
                        <n-button
                          v-if="!taskManager.isTaskRunning(task.id)"
                          size="tiny"
                          quaternary
                          class="action-btn"
                          @click.stop="handleTaskRun(task)"
                        >
                          <template #icon>
                            <n-icon size="12">
                              <component :is="svgIcons.play" />
                            </n-icon>
                          </template>
                        </n-button>
                        <n-button
                          v-if="taskManager.isTaskRunning(task.id)"
                          size="tiny"
                          quaternary
                          class="action-btn stop-btn"
                          @click.stop="handleTaskStop(task)"
                        >
                          <template #icon>
                            <n-icon size="12">
                              <component :is="svgIcons.stop" />
                            </n-icon>
                          </template>
                        </n-button>
                        <n-button
                          v-if="taskManager.isTaskRunning(task.id)"
                          size="tiny"
                          quaternary
                          class="action-btn restart-btn"
                          @click.stop="handleTaskRun(task)"
                        >
                          <template #icon>
                            <n-icon size="12">
                              <component :is="svgIcons.refresh" />
                            </n-icon>
                          </template>
                        </n-button>
                        <n-button
                          size="tiny"
                          quaternary
                          :class="['action-btn', 'favorite-btn', { active: taskManager.isFavorite(task.id) }]"
                          @click.stop="handleToggleFavorite(task)"
                        >
                          <template #icon>
                            <n-icon size="12">
                              <component :is="taskManager.isFavorite(task.id) ? svgIcons.starFilled : svgIcons.star" />
                            </n-icon>
                          </template>
                        </n-button>
                        <n-button
                          size="tiny"
                          quaternary
                          class="action-btn"
                          @click.stop="handleTaskEditVisual(task)"
                        >
                          <template #icon>
                            <n-icon size="12">
                              <component :is="svgIcons.edit" />
                            </n-icon>
                          </template>
                        </n-button>
                        <n-button
                          size="tiny"
                          quaternary
                          class="action-btn delete-btn"
                          @click.stop="handleDeleteUserTask(task.id)"
                        >
                          <template #icon>
                            <n-icon size="12">
                              <component :is="svgIcons.close" />
                            </n-icon>
                          </template>
                        </n-button>
                      </div>
                    </div>
                  </template>
                  <div class="task-tooltip">
                    <div class="tooltip-command">{{ getFullCommand(task) }}</div>
                    <div v-if="task.cwd" class="tooltip-cwd">{{ task.cwd }}</div>
                  </div>
                </n-tooltip>
              </template>
            </template>
            
            <!-- Divider between groups and folders -->
            <div v-if="taskManager.treeItems.length > 0" class="section-divider"></div>
            
            <!-- Folder tree -->
            <template v-for="folder in taskManager.treeItems" :key="folder.id">
              <!-- Folder node -->
              <div 
                class="tree-node folder-node"
                @click="toggleNode(folder.id)"
              >
                <n-icon size="14" class="tree-icon expand-icon">
                  <component :is="isExpanded(folder.id) ? svgIcons.chevronDown : svgIcons.chevronRight" />
                </n-icon>
                <n-icon size="16" class="tree-icon folder-icon">
                  <component :is="svgIcons.folder" />
                </n-icon>
                <span class="tree-label">{{ folder.label }}</span>
                <div class="folder-actions">
                  <!-- Scan folder button -->
                  <n-tooltip trigger="hover" :delay="500">
                    <template #trigger>
                      <n-button
                        size="tiny"
                        quaternary
                        :loading="taskManager.isScanning"
                        @click.stop="handleScanFolder(folder.id.replace('folder:', ''))"
                      >
                        <template #icon>
                          <n-icon size="14">
                            <component :is="svgIcons.refresh" />
                          </n-icon>
                        </template>
                      </n-button>
                    </template>
                    {{ t('task.scan') }}
                  </n-tooltip>
                  <!-- Open in system explorer button -->
                  <n-tooltip trigger="hover" :delay="500">
                    <template #trigger>
                      <n-button
                        size="tiny"
                        quaternary
                        @click.stop="handleOpenInExplorer(folder.id.replace('folder:', ''))"
                      >
                        <template #icon>
                          <n-icon size="14">
                            <component :is="svgIcons.externalLink" />
                          </n-icon>
                        </template>
                      </n-button>
                    </template>
                    {{ t('task.openInExplorer') }}
                  </n-tooltip>
                  <!-- Remove folder button -->
                  <n-button
                    size="tiny"
                    quaternary
                    @click.stop="handleRemoveFolder(folder.id.replace('folder:', ''))"
                  >
                    <template #icon>
                      <n-icon size="14">
                        <component :is="svgIcons.close" />
                      </n-icon>
                    </template>
                  </n-button>
                </div>
              </div>
              
              <!-- Source nodes -->
              <template v-if="isExpanded(folder.id)">
                <template v-for="source in folder.children" :key="source.id">
                  <div 
                    class="tree-node source-node"
                    @click="toggleNode(source.id)"
                  >
                    <n-icon size="14" class="tree-icon expand-icon">
                      <component :is="isExpanded(source.id) ? svgIcons.chevronDown : svgIcons.chevronRight" />
                    </n-icon>
                    <n-icon size="16" class="tree-icon source-icon">
                      <component :is="getSourceIcon(source.icon)" />
                    </n-icon>
                    <span class="tree-label">{{ source.label }}</span>
                    <span class="tree-badge">{{ source.children?.length || 0 }}</span>
                    <div class="source-actions">
                      <!-- Scan folder button -->
                      <n-tooltip trigger="hover" :delay="500">
                        <template #trigger>
                          <n-button
                            size="tiny"
                            quaternary
                            :loading="taskManager.isScanning"
                            @click.stop="handleScanFolder(getSourceFolderPath(source.id))"
                          >
                            <template #icon>
                              <n-icon size="14">
                                <component :is="svgIcons.refresh" />
                              </n-icon>
                            </template>
                          </n-button>
                        </template>
                        {{ t('task.scan') }}
                      </n-tooltip>
                      <!-- Open in system explorer button -->
                      <n-tooltip trigger="hover" :delay="500">
                        <template #trigger>
                          <n-button
                            size="tiny"
                            quaternary
                            @click.stop="handleOpenInExplorer(getSourceFolderPath(source.id))"
                          >
                            <template #icon>
                              <n-icon size="14">
                                <component :is="svgIcons.externalLink" />
                              </n-icon>
                            </template>
                          </n-button>
                        </template>
                        {{ t('task.openInExplorer') }}
                      </n-tooltip>
                    </div>
                  </div>
                  
                  <!-- Task nodes -->
                  <template v-if="isExpanded(source.id)">
                    <n-tooltip
                      v-for="taskItem in source.children" 
                      :key="taskItem.id"
                      trigger="hover"
                      placement="right"
                      :delay="500"
                    >
                      <template #trigger>
                        <div 
                          class="tree-node task-node"
                          :class="{ 'task-running': taskManager.isTaskRunning(taskItem.task!.id) }"
                          @click="handleTaskClick(taskItem.task!)"
                        >
                          <n-icon size="14" class="tree-icon task-type-icon">
                            <component :is="getTaskIcon(taskItem.task!)" />
                          </n-icon>
                          <span class="tree-label task-label">{{ taskItem.label }}</span>
                          <!-- Floating action buttons -->
                          <div class="task-actions-float">
                            <n-button
                              v-if="!taskManager.isTaskRunning(taskItem.task!.id)"
                              size="tiny"
                              quaternary
                              class="action-btn"
                              @click.stop="handleTaskRun(taskItem.task!)"
                            >
                              <template #icon>
                                <n-icon size="12">
                                  <component :is="svgIcons.play" />
                                </n-icon>
                              </template>
                            </n-button>
                            <n-button
                              v-if="taskManager.isTaskRunning(taskItem.task!.id)"
                              size="tiny"
                              quaternary
                              class="action-btn stop-btn"
                              @click.stop="handleTaskStop(taskItem.task!)"
                            >
                              <template #icon>
                                <n-icon size="12">
                                  <component :is="svgIcons.stop" />
                                </n-icon>
                              </template>
                            </n-button>
                            <n-button
                              v-if="taskManager.isTaskRunning(taskItem.task!.id)"
                              size="tiny"
                              quaternary
                              class="action-btn restart-btn"
                              @click.stop="handleTaskRun(taskItem.task!)"
                            >
                              <template #icon>
                                <n-icon size="12">
                                  <component :is="svgIcons.refresh" />
                                </n-icon>
                              </template>
                            </n-button>
                            <n-button
                              size="tiny"
                              quaternary
                              :class="['action-btn', 'favorite-btn', { active: taskManager.isFavorite(taskItem.task!.id) }]"
                              @click.stop="handleToggleFavorite(taskItem.task!)"
                            >
                              <template #icon>
                                <n-icon size="12">
                                  <component :is="taskManager.isFavorite(taskItem.task!.id) ? svgIcons.starFilled : svgIcons.star" />
                                </n-icon>
                              </template>
                            </n-button>
                            <n-button
                              size="tiny"
                              quaternary
                              class="action-btn"
                              @click.stop="handleTaskEditVisual(taskItem.task!)"
                            >
                              <template #icon>
                                <n-icon size="12">
                                  <component :is="svgIcons.edit" />
                                </n-icon>
                              </template>
                            </n-button>
                          </div>
                        </div>
                      </template>
                      <div class="task-tooltip">
                        <div class="tooltip-command">{{ getFullCommand(taskItem.task!) }}</div>
                        <div v-if="taskItem.task!.cwd" class="tooltip-cwd">{{ taskItem.task!.cwd }}</div>
                      </div>
                    </n-tooltip>
                  </template>
                </template>
              </template>
            </template>
          </div>
        </n-scrollbar>
      </div>
    </div>
  </n-layout-sider>
  
  <!-- Add/Edit Task Dialog -->
  <n-modal 
    v-model:show="showTaskDialog"
    preset="dialog"
    :title="isEditMode ? t('task.editTask') : t('task.addTask')"
    :positive-text="t('common.save')"
    :negative-text="t('common.cancel')"
    style="width: 500px;"
    @positive-click="handleSaveTask"
  >
    <n-form ref="taskFormRef" :model="editingTask" :rules="taskRules" label-placement="left" label-width="auto">
      <n-form-item :label="t('task.name')" path="name">
        <n-input v-model:value="editingTask.name" :placeholder="t('task.namePlaceholder')" />
      </n-form-item>
      <n-form-item :label="t('task.command')" path="command">
        <n-input v-model:value="editingTask.command" :placeholder="t('task.commandPlaceholder')" />
      </n-form-item>
      <n-form-item :label="t('task.args')">
        <n-input 
          v-model:value="editingTask.argsStr" 
          type="textarea"
          :placeholder="t('task.argsPlaceholder')"
          :autosize="{ minRows: 1, maxRows: 10 }"
          class="args-textarea"
        />
      </n-form-item>
      <n-form-item :label="t('task.cwd')">
        <n-input-group>
          <n-input v-model:value="editingTask.cwd" :placeholder="t('task.cwdPlaceholder')" />
          <n-button @click="selectWorkingDirectory">
            <template #icon>
              <n-icon size="16">
                <component :is="svgIcons.folderOpen" />
              </n-icon>
            </template>
          </n-button>
        </n-input-group>
      </n-form-item>
      <n-form-item :label="t('task.useSystemTerminal')">
        <n-switch v-model:value="editingTask.useSystemTerminal" />
      </n-form-item>
      <n-form-item v-if="isUserTask" :label="t('task.group')">
        <n-select
          v-model:value="editingTaskGroupId"
          :options="editGroupOptionsWithNew"
        />
      </n-form-item>
      <n-form-item v-if="isUserTask && editingTaskGroupId === '__new__'" :label="t('task.newGroupName')">
        <n-input v-model:value="newGroupNameInEdit" :placeholder="t('task.newGroupPlaceholder')" />
      </n-form-item>
    </n-form>
  </n-modal>
  
  <!-- Rename Group Dialog -->
  <n-modal
    v-model:show="showRenameGroupDialog"
    preset="dialog"
    :title="t('task.renameGroup')"
    :positive-text="t('common.save')"
    :negative-text="t('common.cancel')"
    style="width: 400px;"
    @positive-click="handleConfirmRenameGroup"
  >
    <n-form label-placement="left" label-width="auto">
      <n-form-item :label="t('task.groupName')">
        <n-input v-model:value="renameGroupData.newName" :placeholder="t('task.groupNamePlaceholder')" />
      </n-form-item>
    </n-form>
  </n-modal>
  
  <!-- Add Folder Dialog -->
  <n-modal 
    v-model:show="showAddFolderDialog"
    preset="dialog"
    :title="t('task.addFolder')"
    :positive-text="addFolderData.isImportMode ? t('task.scanTasks') : t('common.confirm')"
    :negative-text="t('common.cancel')"
    style="width: 520px;"
    :positive-button-props="{ disabled: !addFolderData.sourceFolder }"
    @positive-click="handleConfirmAddFolder"
  >
    <n-form label-placement="top">
      <!-- Folder selection -->
      <n-form-item :label="t('task.selectFolder')">
        <n-input-group>
          <n-input v-model:value="addFolderData.sourceFolder" readonly :placeholder="t('task.selectSourceFolder')" />
          <n-button @click="handleSelectAddFolder">{{ t('task.browse') }}</n-button>
        </n-input-group>
      </n-form-item>
      
      <!-- Mode switch -->
      <n-form-item :label="t('task.addFolderMode')">
        <n-radio-group v-model:value="addFolderData.isImportMode">
          <n-space vertical>
            <n-radio :value="false">
              <div class="mode-option">
                <span class="mode-title">{{ t('task.modeOpen') }}</span>
                <span class="mode-desc">{{ t('task.modeOpenDesc') }}</span>
              </div>
            </n-radio>
            <n-radio :value="true">
              <div class="mode-option">
                <span class="mode-title">{{ t('task.modeImport') }}</span>
                <span class="mode-desc">{{ t('task.modeImportDesc') }}</span>
              </div>
            </n-radio>
          </n-space>
        </n-radio-group>
      </n-form-item>
      
      <!-- Import options (only shown in import mode) -->
      <template v-if="addFolderData.isImportMode">
        <n-form-item :label="t('task.targetGroup')">
          <n-select
            v-model:value="addFolderData.targetGroupId"
            :options="userGroupOptions"
          />
        </n-form-item>
        <n-form-item v-if="addFolderData.targetGroupId === '__new__'" :label="t('task.newGroupName')">
          <n-input v-model:value="addFolderData.newGroupName" :placeholder="t('task.newGroupPlaceholder')" />
        </n-form-item>
      </template>
    </n-form>
  </n-modal>
  
  <!-- Import Task Selection Dialog - Step 2: Select tasks -->
  <n-modal 
    v-model:show="showTaskSelectionDialog"
    preset="dialog"
    :title="t('task.selectTasksToImport')"
    :positive-text="t('task.importSelected')"
    :negative-text="t('common.cancel')"
    style="width: 600px;"
    :positive-button-props="{ disabled: selectedImportTasks.length === 0 }"
    @positive-click="handleConfirmImport"
  >
    <div class="import-task-selection">
      <div class="selection-header">
        <n-checkbox 
          :checked="isAllTasksSelected" 
          :indeterminate="isPartialTasksSelected"
          @update:checked="handleSelectAllTasks"
        >
          {{ t('task.selectAll') }} ({{ selectedImportTasks.length }}/{{ scannedTasks.length }})
        </n-checkbox>
      </div>
      <n-scrollbar style="max-height: 400px;">
        <div v-if="scannedTasks.length === 0" class="no-tasks-found">
          {{ t('task.noTasksFound') }}
        </div>
        <div 
          v-for="task in scannedTasks" 
          :key="task.id" 
          class="import-task-item"
          :class="{ selected: selectedImportTasks.includes(task.id), duplicate: isDuplicateTask(task) }"
        >
          <n-checkbox 
            :checked="selectedImportTasks.includes(task.id)"
            @update:checked="(checked: boolean) => handleToggleTaskSelection(task.id, checked)"
          >
            <div class="task-info">
              <div class="task-name">{{ task.name }}</div>
              <div class="task-command">{{ task.command }} {{ task.args?.join(' ') || '' }}</div>
              <div v-if="isDuplicateTask(task)" class="task-duplicate-hint">
                {{ t('task.willOverwrite') }}
              </div>
            </div>
          </n-checkbox>
        </div>
      </n-scrollbar>
    </div>
  </n-modal>
  
  <!-- AI Generate Dialog -->
  <n-modal 
    v-model:show="showAIDialog"
    preset="dialog"
    :title="t('task.aiGenerate')"
    style="width: 600px;"
    :show-icon="false"
  >
    <div class="ai-dialog-content">
      <!-- AI Provider Selection -->
      <n-form-item :label="t('task.aiProvider')">
        <n-select
          v-model:value="aiConfig.provider"
          :options="aiProviderOptions"
        />
      </n-form-item>
      
      <!-- Ollama Settings -->
      <template v-if="aiConfig.provider === 'ollama'">
        <n-form-item :label="t('task.ollamaUrl')">
          <n-input
            v-model:value="aiConfig.ollamaUrl"
            :placeholder="'http://localhost:11434'"
          />
        </n-form-item>
        <n-form-item :label="t('task.ollamaModel')">
          <n-select
            v-model:value="aiConfig.ollamaModel"
            :options="ollamaModelOptions"
            filterable
            tag
          />
        </n-form-item>
      </template>
      
      <!-- API Key Input (for non-Ollama providers) -->
      <n-form-item v-if="aiConfig.provider !== 'ollama'" :label="t('task.aiApiKey')">
        <n-input
          v-model:value="aiConfig.apiKey"
          type="password"
          show-password-on="click"
          :placeholder="t('task.aiApiKeyPlaceholder')"
        />
      </n-form-item>
      
      <!-- Chat Input -->
      <n-form-item :label="t('task.aiPrompt')">
        <n-input
          v-model:value="aiConfig.prompt"
          type="textarea"
          :placeholder="t('task.aiPromptPlaceholder')"
          :autosize="{ minRows: 3, maxRows: 6 }"
        />
      </n-form-item>
      
      <!-- Generate Button -->
      <div class="ai-actions">
        <n-button 
          type="primary" 
          :loading="aiConfig.loading"
          :disabled="(aiConfig.provider !== 'ollama' && !aiConfig.apiKey) || !aiConfig.prompt"
          @click="handleAIGenerate"
        >
          {{ t('task.aiGenerateBtn') }}
        </n-button>
      </div>
      
      <!-- Generated Result -->
      <div v-if="aiConfig.result" class="ai-result">
        <n-divider>{{ t('task.aiResult') }}</n-divider>
        <div class="generated-task">
          <div class="result-item">
            <span class="result-label">{{ t('task.name') }}:</span>
            <span class="result-value">{{ aiConfig.result.name }}</span>
          </div>
          <div class="result-item">
            <span class="result-label">{{ t('task.command') }}:</span>
            <span class="result-value monospace">{{ aiConfig.result.command }}</span>
          </div>
          <div v-if="aiConfig.result.args?.length" class="result-item">
            <span class="result-label">{{ t('task.args') }}:</span>
            <span class="result-value monospace">{{ aiConfig.result.args.join(' ') }}</span>
          </div>
          <div v-if="aiConfig.result.cwd" class="result-item">
            <span class="result-label">{{ t('task.cwd') }}:</span>
            <span class="result-value monospace">{{ aiConfig.result.cwd }}</span>
          </div>
        </div>
        <div class="ai-result-actions">
          <n-button @click="handleAddAIResult">{{ t('task.addToTasks') }}</n-button>
          <n-button tertiary @click="handleEditAIResult">{{ t('task.editAndAdd') }}</n-button>
        </div>
      </div>
      
      <!-- Error Message -->
      <n-alert v-if="aiConfig.error" type="error" :title="t('error.title')" style="margin-top: 16px;">
        {{ aiConfig.error }}
      </n-alert>
    </div>
  </n-modal>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch, reactive } from 'vue';
import {
  NLayoutSider,
  NSpace,
  NButton,
  NScrollbar,
  NTooltip,
  NIcon,
  NModal,
  NForm,
  NFormItem,
  NInput,
  NInputGroup,
  NSelect,
  NSwitch,
  NDivider,
  NCheckbox,
  NAlert,
  NRadio,
  NRadioGroup,
  type FormRules,
} from 'naive-ui';
import { useI18n } from 'vue-i18n';
import { open } from '@tauri-apps/plugin-dialog';
import { useUIStore } from '../stores/ui';
import { useTaskManagerStore } from '../stores/taskManager';
import { useSettingsStore } from '../stores/settings';
import { useUpdaterStore } from '../stores/updater';
import { useTheme } from '../composables/useTheme';
import { svgIcons, getCommandIconName } from '../utils/icons';
import type { Task, TaskGroup } from '../providers/types';

const { t } = useI18n();
const uiStore = useUIStore();
const taskManager = useTaskManagerStore();
const settingsStore = useSettingsStore();
const updaterStore = useUpdaterStore();
const { effectiveTheme } = useTheme();

// Current version
const currentVersion = ref('');

// Expanded nodes state
const expandedNodes = ref<Set<string>>(new Set());

// Task dialog state
const showTaskDialog = ref(false);
const isEditMode = ref(false);
const isUserTask = ref(false);
const editingTaskGroupId = ref('default');
const taskFormRef = ref<any>(null);
const editingTask = ref({
  id: '',
  name: '',
  command: '',
  argsStr: '',
  cwd: '',
  group: 'none' as TaskGroup,
  type: 'shell' as 'shell' | 'process',
  sourceFile: '',
  useSystemTerminal: false,
});

// AI dialog state
const showAIDialog = ref(false);
interface AIGeneratedTask {
  name: string;
  command: string;
  args?: string[];
  cwd?: string;
  group?: TaskGroup;
  type?: 'shell' | 'process';
}
const aiConfig = reactive({
  provider: 'ollama' as 'ollama' | 'openai' | 'anthropic' | 'deepseek',
  apiKey: '',
  ollamaUrl: 'http://localhost:11434',
  ollamaModel: 'qwen2.5:3b',
  prompt: '',
  loading: false,
  result: null as AIGeneratedTask | null,
  error: '',
});

// AI provider options
const aiProviderOptions = [
  { label: 'Ollama (本地)', value: 'ollama' },
  { label: 'OpenAI (GPT-4)', value: 'openai' },
  { label: 'Anthropic (Claude)', value: 'anthropic' },
  { label: 'DeepSeek', value: 'deepseek' },
];

// Ollama model options
const ollamaModelOptions = [
  { label: 'Qwen2.5 3B', value: 'qwen2.5:3b' },
  { label: 'Qwen2.5 Coder 3B', value: 'qwen2.5-coder:3b' },
  { label: 'Qwen2.5 7B', value: 'qwen2.5:7b' },
  { label: 'Llama3.2 3B', value: 'llama3.2:3b' },
  { label: 'Phi3 Mini', value: 'phi3:mini' },
  { label: 'Mistral 7B', value: 'mistral:7b' },
];

// Import dialog state
const showAddFolderDialog = ref(false);
const showTaskSelectionDialog = ref(false);
const scannedTasks = ref<Task[]>([]);
const selectedImportTasks = ref<string[]>([]);
const addFolderData = reactive({
  sourceFolder: '',
  isImportMode: false, // false = open folder, true = import tasks
  targetGroupId: 'default',
  newGroupName: '',
});

// Rename group dialog state
const showRenameGroupDialog = ref(false);
const renameGroupData = reactive({
  groupId: '',
  newName: '',
});

// New group name when editing task
const newGroupNameInEdit = ref('');

// Drag and drop state
const draggedTask = ref<Task | null>(null);
const dragOverGroupId = ref<string | null>(null);

// Favorite drag and drop state (using mouse events for better compatibility)
const favoriteDraggedTask = ref<Task | null>(null);
const favoriteDraggedIndex = ref<number>(-1);
const favoriteDragOverIndex = ref<number>(-1);
const favoriteDragPosition = ref<'top' | 'bottom' | null>(null);
const isDraggingFavorite = ref(false);

// Computed for task selection
const isAllTasksSelected = computed(() => 
  scannedTasks.value.length > 0 && selectedImportTasks.value.length === scannedTasks.value.length
);

const isPartialTasksSelected = computed(() => 
  selectedImportTasks.value.length > 0 && selectedImportTasks.value.length < scannedTasks.value.length
);

// Check if a task would be a duplicate (same name in target group)
const isDuplicateTask = (task: Task): boolean => {
  const targetGroupId = addFolderData.targetGroupId === '__new__' ? null : addFolderData.targetGroupId;
  if (!targetGroupId) return false;
  
  const group = taskManager.userGroups.find(g => g.id === targetGroupId);
  if (!group) return false;
  
  return group.tasks.some(t => t.name === task.name);
};

// User group options for select
const userGroupOptions = computed(() => [
  ...taskManager.userGroups.map(g => ({
    label: g.name,
    value: g.id,
  })),
  { label: t('task.createNewGroup'), value: '__new__' },
]);

// Edit group options with "create new" option
const editGroupOptionsWithNew = computed(() => [
  ...taskManager.userGroups.map(g => ({
    label: g.name,
    value: g.id,
  })),
  { label: t('task.createNewGroup'), value: '__new__' },
]);

// Form rules
const taskRules: FormRules = {
  name: [{ required: true, message: () => t('task.nameRequired') }],
  command: [{ required: true, message: () => t('task.commandRequired') }],
};

// Check if a node is expanded
const isExpanded = (nodeId: string) => expandedNodes.value.has(nodeId);

// Toggle node expansion
const toggleNode = (nodeId: string) => {
  if (expandedNodes.value.has(nodeId)) {
    expandedNodes.value.delete(nodeId);
  } else {
    expandedNodes.value.add(nodeId);
  }
};

// Get source icon component
const getSourceIcon = (icon?: string) => {
  switch (icon) {
    case 'vscode':
      return svgIcons.vscode || svgIcons.task;
    case 'npm':
      return svgIcons.npm || svgIcons.task;
    default:
      return svgIcons.task;
  }
};

// Get folder label for favorite tasks (non-user tasks only)
const getFavoriteFolderLabel = (task: Task): string | null => {
  if (task.source === 'user') {
    return null;
  }
  // Extract folder name from sourceFile or cwd
  const path = task.sourceFile || task.cwd;
  if (!path) {
    return null;
  }
  // Get the parent folder name (e.g., "/path/to/project/.vscode/tasks.json" -> "project")
  const parts = path.split(/[/\\]/);
  // For sourceFile, go up one or two levels; for cwd, use last segment
  if (task.sourceFile) {
    // sourceFile like "/path/to/project/.vscode/tasks.json" or "/path/to/project/package.json"
    const idx = parts.findIndex(p => p === '.vscode' || p === 'package.json' || p === 'tasks.json');
    if (idx > 0) {
      return parts[idx - 1];
    }
    // Fallback: second to last non-empty segment
    const nonEmpty = parts.filter(p => p);
    return nonEmpty.length >= 2 ? nonEmpty[nonEmpty.length - 2] : null;
  } else {
    // cwd: use last segment
    const nonEmpty = parts.filter(p => p);
    return nonEmpty.length > 0 ? nonEmpty[nonEmpty.length - 1] : null;
  }
};

// Get task icon component based on command or group
const getTaskIcon = (task: Task) => {
  // Get icon by command (includes both default and user custom icons)
  const customIcons = settingsStore.settings.commandIcons || {};
  const iconName = getCommandIconName(task.command, customIcons);
  if (iconName !== 'task' && svgIcons[iconName as keyof typeof svgIcons]) {
    return svgIcons[iconName as keyof typeof svgIcons];
  }
  
  // Fallback to group-based icon
  switch (task.group) {
    case 'build':
      return svgIcons.build || svgIcons.task;
    case 'test':
      return svgIcons.test || svgIcons.task;
    case 'clean':
      return svgIcons.clean || svgIcons.task;
    default:
      return svgIcons.task;
  }
};

// Get full command string for tooltip
const getFullCommand = (task: Task): string => {
  let cmd = task.command;
  if (task.args && task.args.length > 0) {
    cmd += ' ' + task.args.join(' ');
  }
  return cmd;
};

// Handle add folder - opens dialog to choose open or import mode
const handleAddFolder = () => {
  addFolderData.sourceFolder = '';
  addFolderData.isImportMode = false;
  addFolderData.targetGroupId = 'default';
  addFolderData.newGroupName = '';
  showAddFolderDialog.value = true;
};

// Handle select folder in add folder dialog
const handleSelectAddFolder = async () => {
  try {
    const selected = await open({
      directory: true,
      multiple: false,
      title: t('task.selectFolder'),
    });
    
    if (selected && typeof selected === 'string') {
      addFolderData.sourceFolder = selected;
    }
  } catch (error) {
    console.error('[TaskSidebar] Failed to select folder:', error);
  }
};

// Handle confirm add folder - either open or import based on mode
const handleConfirmAddFolder = async () => {
  if (!addFolderData.sourceFolder) {
    return false;
  }
  
  if (addFolderData.isImportMode) {
    // Import mode - scan for tasks
    try {
      const tasks = await taskManager.scanFolderForTasks(addFolderData.sourceFolder);
      scannedTasks.value = tasks;
      selectedImportTasks.value = tasks.map(t => t.id);
      
      // Close add folder dialog and show task selection
      showAddFolderDialog.value = false;
      showTaskSelectionDialog.value = true;
    } catch (error) {
      console.error('[TaskSidebar] Failed to scan folder for tasks:', error);
    }
    return false; // Prevent auto-close (we close manually)
  } else {
    // Open mode - add folder directly
    try {
      await taskManager.addFolder(addFolderData.sourceFolder);
      
      // Auto expand all nodes
      for (const folder of taskManager.treeItems) {
        expandedNodes.value.add(folder.id);
        for (const source of folder.children || []) {
          expandedNodes.value.add(source.id);
        }
      }
    } catch (error) {
      console.error('[TaskSidebar] Failed to add folder:', error);
    }
    return true; // Allow auto-close
  }
};

// Handle select working directory for task
const selectWorkingDirectory = async () => {
  try {
    const selected = await open({
      directory: true,
      multiple: false,
      title: t('task.selectWorkingDirectory'),
    });
    
    if (selected && typeof selected === 'string') {
      editingTask.value.cwd = selected;
    }
  } catch (error) {
    console.error('[TaskSidebar] Failed to select working directory:', error);
  }
};

// Handle select all tasks
const handleSelectAllTasks = (checked: boolean) => {
  if (checked) {
    selectedImportTasks.value = scannedTasks.value.map(t => t.id);
  } else {
    selectedImportTasks.value = [];
  }
};

// Handle toggle single task selection
const handleToggleTaskSelection = (taskId: string, checked: boolean) => {
  if (checked) {
    if (!selectedImportTasks.value.includes(taskId)) {
      selectedImportTasks.value = [...selectedImportTasks.value, taskId];
    }
  } else {
    selectedImportTasks.value = selectedImportTasks.value.filter(id => id !== taskId);
  }
};

// Handle confirm import - Step 2 complete
const handleConfirmImport = async () => {
  if (selectedImportTasks.value.length === 0) {
    return false;
  }
  
  try {
    let targetGroupId = addFolderData.targetGroupId;
    
    // Create new group if needed
    if (targetGroupId === '__new__' && addFolderData.newGroupName.trim()) {
      const newGroup = await taskManager.createUserGroup(addFolderData.newGroupName.trim());
      targetGroupId = newGroup.id;
    }
    
    // Get selected tasks
    const tasksToImport = scannedTasks.value.filter(t => selectedImportTasks.value.includes(t.id));
    
    // Import tasks to the group with overwrite
    const importedCount = await taskManager.importTasksToGroupWithOverwrite(targetGroupId, tasksToImport);
    console.log(`[TaskSidebar] Imported ${importedCount} tasks`);
    
    // Auto expand the group
    expandedNodes.value.add(`group:${targetGroupId}`);
    
    showTaskSelectionDialog.value = false;
    return true;
  } catch (error) {
    console.error('[TaskSidebar] Failed to import:', error);
    return false;
  }
};

// Handle remove folder
const handleRemoveFolder = (folderPath: string) => {
  taskManager.removeFolder(folderPath);
};

// Get folder path from source id (format: source:folderPath:sourceName)
const getSourceFolderPath = (sourceId: string): string => {
  // sourceId format: "source:/path/to/folder:npm" or "source:/path/to/folder:vscode"
  const parts = sourceId.split(':');
  // Remove 'source' prefix and source name suffix, join the middle parts (path may contain colons on Windows)
  if (parts.length >= 3) {
    return parts.slice(1, -1).join(':');
  }
  return '';
};

// Handle scan folder
const handleScanFolder = async (folderPath: string) => {
  if (folderPath) {
    await taskManager.scanFolders([folderPath]);
  }
};

// Handle open in explorer
const handleOpenInExplorer = async (folderPath: string) => {
  if (folderPath) {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('open_file_with_default_app', { path: folderPath });
    } catch (error) {
      console.error('[TaskSidebar] Failed to open folder:', error);
    }
  }
};

// Handle delete user group
const handleDeleteGroup = async (groupId: string) => {
  await taskManager.deleteUserGroup(groupId);
};

// Handle rename group - open dialog
const handleRenameGroup = (group: { id: string; name: string }) => {
  renameGroupData.groupId = group.id;
  renameGroupData.newName = group.name;
  showRenameGroupDialog.value = true;
};

// Handle confirm rename group
const handleConfirmRenameGroup = async () => {
  if (!renameGroupData.newName.trim()) {
    return false;
  }
  await taskManager.renameUserGroup(renameGroupData.groupId, renameGroupData.newName.trim());
  showRenameGroupDialog.value = false;
  return true;
};

// Drag and drop handlers
const handleDragStart = (event: DragEvent, task: Task) => {
  draggedTask.value = task;
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', task.id);
  }
};

const handleDragEnd = () => {
  draggedTask.value = null;
  dragOverGroupId.value = null;
};

const handleDragOver = (event: DragEvent, groupId: string) => {
  event.preventDefault();
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = 'move';
  }
  dragOverGroupId.value = groupId;
};

const handleDragLeave = () => {
  dragOverGroupId.value = null;
};

const handleDrop = async (event: DragEvent, targetGroupId: string) => {
  event.preventDefault();
  dragOverGroupId.value = null;
  
  if (draggedTask.value) {
    await taskManager.moveTaskToGroup(draggedTask.value.id, targetGroupId);
    // Auto expand target group
    expandedNodes.value.add(`group:${targetGroupId}`);
  }
  draggedTask.value = null;
};

// Favorite reorder using mouse events (more compatible with Tauri webview)
const handleFavoriteMouseDown = (event: MouseEvent, task: Task, index: number) => {
  // Only handle left mouse button
  if (event.button !== 0) return;
  
  // Don't start drag if clicking on action buttons
  const target = event.target as HTMLElement;
  if (target.closest('.task-actions-float')) return;
  
  console.log('[TaskSidebar] Favorite mouse down:', { task: task.name, index });
  
  favoriteDraggedTask.value = task;
  favoriteDraggedIndex.value = index;
  isDraggingFavorite.value = false;
  
  // Add global mouse event listeners
  document.addEventListener('mousemove', handleFavoriteMouseMove);
  document.addEventListener('mouseup', handleFavoriteMouseUp);
};

const handleFavoriteMouseMove = (event: MouseEvent) => {
  if (favoriteDraggedIndex.value === -1) return;
  
  // Start dragging after a small movement threshold
  if (!isDraggingFavorite.value) {
    isDraggingFavorite.value = true;
    console.log('[TaskSidebar] Favorite drag started');
  }
  
  // Find which favorite item we're over
  const favoriteNodes = document.querySelectorAll('.favorite-task-node');
  let foundIndex = -1;
  let position: 'top' | 'bottom' | null = null;
  
  favoriteNodes.forEach((node, idx) => {
    const rect = node.getBoundingClientRect();
    if (event.clientY >= rect.top && event.clientY <= rect.bottom) {
      foundIndex = idx;
      const midY = rect.top + rect.height / 2;
      position = event.clientY < midY ? 'top' : 'bottom';
    }
  });
  
  if (foundIndex !== -1 && (favoriteDragOverIndex.value !== foundIndex || favoriteDragPosition.value !== position)) {
    console.log('[TaskSidebar] Favorite drag over:', { index: foundIndex, position });
  }
  
  favoriteDragOverIndex.value = foundIndex;
  favoriteDragPosition.value = position;
};

const handleFavoriteMouseUp = async () => {
  // Remove global listeners
  document.removeEventListener('mousemove', handleFavoriteMouseMove);
  document.removeEventListener('mouseup', handleFavoriteMouseUp);
  
  if (!isDraggingFavorite.value || favoriteDraggedIndex.value === -1) {
    // Reset state without reordering (was just a click)
    favoriteDraggedTask.value = null;
    favoriteDraggedIndex.value = -1;
    favoriteDragOverIndex.value = -1;
    favoriteDragPosition.value = null;
    isDraggingFavorite.value = false;
    return;
  }
  
  const fromIndex = favoriteDraggedIndex.value;
  const targetIndex = favoriteDragOverIndex.value;
  
  if (fromIndex !== -1 && targetIndex !== -1) {
    let toIndex = targetIndex;
    // Adjust index based on drop position
    if (favoriteDragPosition.value === 'bottom') {
      toIndex = targetIndex + 1;
    }
    // If dragging from above the target, adjust the target index
    if (fromIndex < toIndex) {
      toIndex -= 1;
    }
    
    console.log('[TaskSidebar] Favorite drop:', { fromIndex, targetIndex, position: favoriteDragPosition.value, finalToIndex: toIndex });
    
    // Only reorder if actually moving to a different position
    if (fromIndex !== toIndex) {
      await taskManager.reorderFavorites(fromIndex, toIndex);
    }
  }
  
  // Reset state
  favoriteDraggedTask.value = null;
  favoriteDraggedIndex.value = -1;
  favoriteDragOverIndex.value = -1;
  favoriteDragPosition.value = null;
  isDraggingFavorite.value = false;
};

// Handle delete user task
const handleDeleteUserTask = async (taskId: string) => {
  await taskManager.removeTaskFromGroup(taskId);
};

// Handle add task - adds to default user group
const handleAddTask = () => {
  isEditMode.value = false;
  isUserTask.value = true;
  editingTaskGroupId.value = 'default';
  newGroupNameInEdit.value = '';
  editingTask.value = {
    id: '',
    name: '',
    command: '',
    argsStr: '',
    cwd: '',
    group: 'none',
    type: 'shell',
    sourceFile: '',
    useSystemTerminal: false,
  };
  showTaskDialog.value = true;
};

// Handle AI generate
const handleAIGenerate = async () => {
  if (aiConfig.provider !== 'ollama' && !aiConfig.apiKey) return;
  if (!aiConfig.prompt) return;
  
  aiConfig.loading = true;
  aiConfig.error = '';
  aiConfig.result = null;
  
  try {
    const systemPrompt = `You are a helpful assistant that generates shell command configurations.
Given a user's description, generate a task configuration in JSON format with:
- name: A short descriptive name for the task
- command: The main command to run (just the executable, e.g., "npm", "go", "docker")
- args: An array of arguments (optional)
- cwd: Working directory (optional, use relative paths if needed)
- group: One of "none", "build", "test", "clean" (optional)
- type: Either "shell" or "process" (default: "shell")

Respond ONLY with valid JSON, no explanations or markdown code blocks.`;

    const userMessage = aiConfig.prompt;
    
    let response: Response;
    let result: any;
    let content = '';
    
    if (aiConfig.provider === 'ollama') {
      // Ollama local model
      response = await fetch(`${aiConfig.ollamaUrl}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: aiConfig.ollamaModel,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMessage },
          ],
          stream: false,
          options: {
            temperature: 0.7,
          },
        }),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Ollama API error - 请确保 Ollama 服务正在运行');
      }
      
      result = await response.json();
      content = result.message?.content || '';
      
    } else if (aiConfig.provider === 'openai') {
      response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${aiConfig.apiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMessage },
          ],
          temperature: 0.7,
        }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'OpenAI API error');
      }
      
      result = await response.json();
      content = result.choices?.[0]?.message?.content || '';
      
    } else if (aiConfig.provider === 'anthropic') {
      response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': aiConfig.apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: 'claude-3-haiku-20240307',
          max_tokens: 1024,
          system: systemPrompt,
          messages: [
            { role: 'user', content: userMessage },
          ],
        }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'Anthropic API error');
      }
      
      result = await response.json();
      content = result.content?.[0]?.text || '';
      
    } else if (aiConfig.provider === 'deepseek') {
      response = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${aiConfig.apiKey}`,
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMessage },
          ],
          temperature: 0.7,
        }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'DeepSeek API error');
      }
      
      result = await response.json();
      content = result.choices?.[0]?.message?.content || '';
    }
    
    // Parse the JSON content from any provider
    if (content) {
      // Remove markdown code blocks if present
      const cleanContent = content.replace(/```json\n?|\n?```/g, '').trim();
      aiConfig.result = JSON.parse(cleanContent);
    }
    
  } catch (error) {
    console.error('[TaskSidebar] AI generate failed:', error);
    aiConfig.error = String(error);
  } finally {
    aiConfig.loading = false;
  }
};

// Handle add AI result directly
const handleAddAIResult = async () => {
  if (!aiConfig.result) return;
  
  try {
    await taskManager.addTaskToGroup('default', {
      name: aiConfig.result.name,
      command: aiConfig.result.command,
      args: aiConfig.result.args,
      cwd: aiConfig.result.cwd,
      group: aiConfig.result.group || 'none',
      type: aiConfig.result.type || 'shell',
    });
    
    // Auto expand default group
    expandedNodes.value.add('group:default');
    
    // Reset and close dialog
    aiConfig.result = null;
    aiConfig.prompt = '';
    showAIDialog.value = false;
  } catch (error) {
    console.error('[TaskSidebar] Failed to add AI result:', error);
  }
};

// Handle edit AI result before adding
const handleEditAIResult = () => {
  if (!aiConfig.result) return;
  
  // Fill the edit form with AI result
  isEditMode.value = false;
  isUserTask.value = true;
  editingTaskGroupId.value = 'default';
  editingTask.value = {
    id: '',
    name: aiConfig.result.name,
    command: aiConfig.result.command,
    argsStr: aiConfig.result.args?.join(' ') || '',
    cwd: aiConfig.result.cwd || '',
    group: aiConfig.result.group || 'none',
    type: aiConfig.result.type || 'shell',
    sourceFile: '',
    useSystemTerminal: false,
  };
  
  // Close AI dialog and open edit dialog
  showAIDialog.value = false;
  showTaskDialog.value = true;
};

// Handle task visual edit
const handleTaskEditVisual = (task: Task) => {
  isEditMode.value = true;
  isUserTask.value = task.source === 'user';
  // Find which group contains this task
  const group = taskManager.userGroups.find(g => g.tasks.some(t => t.id === task.id));
  editingTaskGroupId.value = group?.id || 'default';
  newGroupNameInEdit.value = '';
  editingTask.value = {
    id: task.id,
    name: task.name,
    command: task.command,
    argsStr: task.args?.join(' ') || '',
    cwd: task.cwd || '',
    group: task.group || 'none',
    type: (task.type || 'shell') as 'shell' | 'process',
    sourceFile: task.sourceFile || '',
    useSystemTerminal: task.useSystemTerminal || false,
  };
  showTaskDialog.value = true;
};

// Handle save task
const handleSaveTask = async () => {
  try {
    await taskFormRef.value?.validate();
    
    const args = editingTask.value.argsStr
      ? editingTask.value.argsStr.split(/\s+/).filter(Boolean)
      : undefined;
    
    // Determine target group ID (create new group if needed)
    let targetGroupId = editingTaskGroupId.value;
    if (isUserTask.value && editingTaskGroupId.value === '__new__' && newGroupNameInEdit.value.trim()) {
      const newGroup = await taskManager.createUserGroup(newGroupNameInEdit.value.trim());
      targetGroupId = newGroup.id;
    }
    
    if (isEditMode.value && isUserTask.value && editingTask.value.id) {
      // Update existing user task
      await taskManager.updateTaskInGroup(editingTask.value.id, {
        name: editingTask.value.name,
        command: editingTask.value.command,
        args,
        group: editingTask.value.group,
        type: editingTask.value.type,
        cwd: editingTask.value.cwd,
        useSystemTerminal: editingTask.value.useSystemTerminal,
      });
      // If group changed, move the task
      const currentGroup = taskManager.userGroups.find(g => g.tasks.some(t => t.id === editingTask.value.id));
      if (currentGroup && currentGroup.id !== targetGroupId) {
        await taskManager.moveTaskToGroup(editingTask.value.id, targetGroupId);
      }
    } else if (isUserTask.value) {
      // Add new task to user group
      await taskManager.addTaskToGroup(targetGroupId, {
        name: editingTask.value.name,
        command: editingTask.value.command,
        args,
        group: editingTask.value.group,
        type: editingTask.value.type,
        cwd: editingTask.value.cwd,
        useSystemTerminal: editingTask.value.useSystemTerminal,
      });
      // Auto expand the group
      expandedNodes.value.add(`group:${targetGroupId}`);
    } else if (taskManager.folders.length > 0) {
      // Add to folder's tasks.json (original behavior)
      const folderPath = editingTask.value.cwd || taskManager.folders[0].path;
      await taskManager.addUserTask(folderPath, {
        name: editingTask.value.name,
        command: editingTask.value.command,
        args,
        group: editingTask.value.group,
        type: editingTask.value.type,
        cwd: editingTask.value.cwd,
        useSystemTerminal: editingTask.value.useSystemTerminal,
      });
    }
    
    showTaskDialog.value = false;
    return true;
  } catch (error) {
    console.error('[TaskSidebar] Failed to save task:', error);
    return false;
  }
};

// Handle task click
const handleTaskClick = (task: Task) => {
  console.log('[TaskSidebar] Task clicked:', task.name);
};

// Handle task run
const handleTaskRun = async (task: Task) => {
  try {
    await taskManager.executeTask(task);
  } catch (error) {
    console.error('[TaskSidebar] Failed to run task:', error);
  }
};

// Handle task stop
const handleTaskStop = async (task: Task) => {
  try {
    await taskManager.stopTask(task.id);
  } catch (error) {
    console.error('[TaskSidebar] Failed to stop task:', error);
  }
};

// Handle toggle favorite
const handleToggleFavorite = async (task: Task) => {
  await taskManager.toggleFavorite(task.id);
};

// Handle show update dialog (emit event to open settings)
const handleShowUpdateDialog = () => {
  // Emit a custom event that TitleBar can listen to
  window.dispatchEvent(new CustomEvent('open-settings-update'));
};

// Initialize
onMounted(async () => {
  // Get current version
  currentVersion.value = await updaterStore.getCurrentVersion();
  
  // Auto check for updates on startup
  await updaterStore.autoCheckForUpdates();
  
  // Initialize listeners for task manager
  taskManager.scanRecursively = true;
  
  // Load saved folders
  await taskManager.initialize();
  
  // Auto-expand favorites section
  expandedNodes.value.add('favorites');
  
  // Auto-expand loaded folders
  for (const folder of taskManager.treeItems) {
    expandedNodes.value.add(folder.id);
    for (const source of folder.children || []) {
      expandedNodes.value.add(source.id);
    }
  }
});

// Auto-expand new folders
watch(() => taskManager.folders.length, () => {
  for (const folder of taskManager.treeItems) {
    expandedNodes.value.add(folder.id);
    for (const source of folder.children || []) {
      expandedNodes.value.add(source.id);
    }
  }
});
</script>

<style scoped>
.task-header-container {
  padding: 0;
}

.task-header-content {
  padding: 16px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.n-config-provider--light .task-header-content {
  border-bottom: 1px solid rgba(0, 0, 0, 0.1);
}

.header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.logo-image {
  width: 24px;
  height: 24px;
  flex-shrink: 0;
}

.logo-version {
  display: flex;
  align-items: center;
  gap: 6px;
}

.version-text {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.5);
  font-weight: 500;
}

.n-config-provider--light .version-text {
  color: rgba(0, 0, 0, 0.45);
}

.update-indicator {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #18a058;
  color: white;
  cursor: pointer;
  animation: pulse 2s infinite;
}

.update-indicator:hover {
  background: #36ad6a;
}

@keyframes pulse {
  0%, 100% {
    box-shadow: 0 0 0 0 rgba(24, 160, 88, 0.4);
  }
  50% {
    box-shadow: 0 0 0 4px rgba(24, 160, 88, 0);
  }
}

.task-tree-container {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  margin-top: 8px;
}

/* Scrollbar positioning - move scrollbar to the right edge */
.task-tree-container :deep(.n-scrollbar-content) {
  padding-right: 14px;
}

.task-tree-container :deep(.n-scrollbar-rail) {
  right: 0 !important;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 16px;
  text-align: center;
  gap: 16px;
}

.empty-text {
  color: rgba(255, 255, 255, 0.5);
  margin: 0;
}

.n-config-provider--light .empty-text {
  color: rgba(0, 0, 0, 0.5);
}

.task-tree {
  padding: 8px 0;
}

.tree-node {
  display: flex;
  align-items: center;
  padding: 6px 12px;
  cursor: pointer;
  border-radius: 4px;
  transition: background-color 0.2s;
  gap: 6px;
  position: relative;
  user-select: none;
  -webkit-user-select: none;
}

.tree-node:hover {
  background-color: rgba(255, 255, 255, 0.05);
}

.n-config-provider--light .tree-node:hover {
  background-color: rgba(0, 0, 0, 0.05);
}

.folder-node {
  padding-left: 8px;
}

.source-node {
  padding-left: 24px;
}

.task-node {
  padding-left: 40px;
  padding-right: 8px;
}

.tree-icon {
  flex-shrink: 0;
  opacity: 0.7;
}

.expand-icon {
  opacity: 0.5;
}

.tree-label {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
  user-select: none;
}

.task-label {
  font-family: monospace;
  user-select: none;
}

.folder-hint {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.4);
  margin-left: 4px;
  font-family: sans-serif;
}

.n-config-provider--light .folder-hint {
  color: rgba(0, 0, 0, 0.4);
}

.tree-badge {
  font-size: 11px;
  background: rgba(255, 255, 255, 0.1);
  padding: 1px 6px;
  border-radius: 10px;
  color: rgba(255, 255, 255, 0.6);
}

.n-config-provider--light .tree-badge {
  background: rgba(0, 0, 0, 0.08);
  color: rgba(0, 0, 0, 0.6);
}

/* Floating action buttons */
.task-actions-float {
  position: absolute;
  right: 4px;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  gap: 0;
  background: linear-gradient(90deg, transparent 0%, var(--action-bg) 20%);
  padding-left: 16px;
  opacity: 0;
  transition: opacity 0.15s;
}

.tree-node:hover .task-actions-float {
  opacity: 1;
}

/* Dark theme action background */
.task-actions-float {
  --action-bg: rgba(36, 36, 36, 0.95);
}

.n-config-provider--light .task-actions-float {
  --action-bg: rgba(255, 255, 255, 0.95);
}

.action-btn {
  padding: 2px !important;
  min-width: 20px !important;
  height: 20px !important;
}

.action-btn:hover {
  background: rgba(255, 255, 255, 0.1);
}

.n-config-provider--light .action-btn:hover {
  background: rgba(0, 0, 0, 0.08);
}

.folder-actions {
  opacity: 0;
  transition: opacity 0.2s;
}

.tree-node:hover .folder-actions {
  opacity: 1;
}

/* Source actions */
.source-actions {
  opacity: 0;
  transition: opacity 0.2s;
  display: flex;
  gap: 0;
}

.tree-node:hover .source-actions {
  opacity: 1;
}

/* Section node (Favorites header) */
.section-node {
  padding-left: 8px;
}

.section-label {
  font-weight: 500;
  color: rgba(255, 255, 255, 0.9);
}

.n-config-provider--light .section-label {
  color: rgba(0, 0, 0, 0.85);
}

.star-icon {
  color: #f5a623;
}

/* Section divider */
.section-divider {
  height: 1px;
  background: rgba(255, 255, 255, 0.1);
  margin: 8px 12px;
}

.n-config-provider--light .section-divider {
  background: rgba(0, 0, 0, 0.08);
}

/* Favorite task node */
.favorite-task-node {
  padding-left: 32px;
  cursor: grab;
  user-select: none;
}

.favorite-task-node:active {
  cursor: grabbing;
}

.favorite-task-node.is-dragging {
  opacity: 0.5;
  background-color: rgba(24, 160, 88, 0.1);
}

/* Favorite drag indicators */
.favorite-task-node.drag-over-top {
  border-top: 2px solid #18a058;
  margin-top: -2px;
}

.favorite-task-node.drag-over-bottom {
  border-bottom: 2px solid #18a058;
  margin-bottom: -2px;
}

/* Favorite button */
.favorite-btn {
  opacity: 0.5;
}

.favorite-btn:hover {
  opacity: 1;
}

.favorite-btn.active {
  opacity: 1;
  color: #f5a623;
}

/* Running task indicator */
.task-running {
  background-color: rgba(24, 160, 88, 0.1);
}

.task-running .task-type-icon {
  color: #18a058;
  animation: glow 1.5s ease-in-out infinite;
}

@keyframes glow {
  0%, 100% {
    opacity: 1;
    filter: drop-shadow(0 0 2px #18a058);
  }
  50% {
    opacity: 0.6;
    filter: drop-shadow(0 0 6px #18a058) drop-shadow(0 0 10px #18a058);
  }
}

/* Stop button */
.stop-btn:hover {
  color: #f44336 !important;
}

/* Restart button */
.restart-btn:hover {
  color: #18a058 !important;
}

/* Group node */
.group-node {
  padding-left: 8px;
}

.group-node.drag-over {
  background-color: rgba(24, 160, 88, 0.2);
  border: 1px dashed #18a058;
  border-radius: 4px;
}

.group-icon {
  color: #7c4dff;
}

.group-actions {
  opacity: 0;
  transition: opacity 0.2s;
  display: flex;
  gap: 0;
}

.tree-node:hover .group-actions {
  opacity: 1;
}

/* Group task node */
.group-task-node {
  padding-left: 32px;
  cursor: grab;
}

.group-task-node:active {
  cursor: grabbing;
}

.group-task-node[draggable="true"]:hover {
  background-color: rgba(255, 255, 255, 0.08);
}

/* Delete button */
.delete-btn:hover {
  color: #f44336 !important;
}

/* Import task selection */
.import-task-selection {
  padding: 8px 0;
}

.selection-header {
  padding: 8px 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  margin-bottom: 8px;
}

.n-config-provider--light .selection-header {
  border-bottom: 1px solid rgba(0, 0, 0, 0.1);
}

.no-tasks-found {
  text-align: center;
  padding: 32px;
  color: rgba(255, 255, 255, 0.5);
}

.n-config-provider--light .no-tasks-found {
  color: rgba(0, 0, 0, 0.5);
}

.import-task-item {
  padding: 8px 12px;
  border-radius: 4px;
  margin: 4px 0;
  transition: background-color 0.2s;
}

.import-task-item:hover {
  background: rgba(255, 255, 255, 0.05);
}

.n-config-provider--light .import-task-item:hover {
  background: rgba(0, 0, 0, 0.05);
}

.import-task-item.selected {
  background: rgba(24, 160, 88, 0.1);
}

.import-task-item.duplicate {
  border-left: 3px solid #f0a020;
}

.task-info {
  margin-left: 8px;
}

.task-name {
  font-weight: 500;
  font-size: 13px;
}

.task-command {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.5);
  font-family: monospace;
  margin-top: 2px;
  word-break: break-all;
}

.n-config-provider--light .task-command {
  color: rgba(0, 0, 0, 0.5);
}

.task-duplicate-hint {
  font-size: 11px;
  color: #f0a020;
  margin-top: 2px;
}

/* Args textarea */
.args-textarea :deep(textarea) {
  font-family: monospace;
  font-size: 13px;
  line-height: 1.5;
}

/* AI Dialog */
.ai-dialog-content {
  padding: 8px 0;
}

.ai-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
}

.ai-result {
  margin-top: 8px;
}

.generated-task {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  padding: 12px;
}

.n-config-provider--light .generated-task {
  background: rgba(0, 0, 0, 0.03);
}

.result-item {
  display: flex;
  margin-bottom: 8px;
}

.result-item:last-child {
  margin-bottom: 0;
}

.result-label {
  width: 80px;
  flex-shrink: 0;
  color: rgba(255, 255, 255, 0.6);
  font-size: 13px;
}

.n-config-provider--light .result-label {
  color: rgba(0, 0, 0, 0.5);
}

.result-value {
  flex: 1;
  font-size: 13px;
}

.result-value.monospace {
  font-family: monospace;
}

.ai-result-actions {
  display: flex;
  gap: 8px;
  margin-top: 16px;
  justify-content: flex-end;
}

/* Add folder dialog mode options */
.mode-option {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.mode-title {
  font-weight: 500;
  font-size: 14px;
}

.mode-desc {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.5);
  line-height: 1.4;
}

.n-config-provider--light .mode-desc {
  color: rgba(0, 0, 0, 0.45);
}

/* Task tooltip */
.task-tooltip {
  max-width: 400px;
}

.tooltip-command {
  font-family: monospace;
  font-size: 12px;
  word-break: break-all;
  white-space: pre-wrap;
}

.tooltip-cwd {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.6);
  margin-top: 4px;
  word-break: break-all;
}

.n-config-provider--light .tooltip-cwd {
  color: rgba(0, 0, 0, 0.5);
}
</style>
