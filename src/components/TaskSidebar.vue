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
    :width="uiStore.sidebarWidth"
    class="sidebar-layout"
    :class="{ 'light-theme': effectiveTheme === 'light' }"
  >
    <div
      class="sidebar-resizer"
      :class="{ active: isResizing }"
      @mousedown="handleResizeMouseDown"
    ></div>
    <div class="sidebar-container">
      <div class="sidebar-search">
        <n-input
          v-model:value="searchQuery"
          size="small"
          :placeholder="t('task.searchPlaceholder') || 'Search tasks...'"
          clearable
        >
          <template #prefix>
            <n-icon :component="svgIcons.search" />
          </template>
        </n-input>
      </div>

      <!-- Search Results -->
      <div v-if="searchQuery" class="task-tree-container">
        <n-scrollbar>
          <div class="task-tree">
            <div v-if="filteredTasks.length === 0" class="empty-state">
              <p class="empty-text">
                {{ t("task.noResults") || "No tasks found" }}
              </p>
            </div>
            <template v-else>
              <TaskNode
                v-for="task in filteredTasks"
                :key="`search-${task.id}`"
                :task="task"
                :is-running="taskManager.isTaskRunning(task.id)"
                :is-favorite="taskManager.isFavorite(task.id)"
                :show-icon="settingsStore.settings.showTaskIcons"
                :show-edit="true"
                @click="handleTaskClick"
                @run="handleTaskRun"
                @stop="handleTaskStop"
                @edit="handleTaskEditVisual"
                @toggle-favorite="handleToggleFavorite"
              />
            </template>
          </div>
        </n-scrollbar>
      </div>

      <!-- Task tree -->
      <div v-else class="task-tree-container">
        <n-scrollbar>
          <!-- Loading state -->
          <div
            v-if="!taskManager.initialized || taskManager.isScanning"
            class="loading-state"
          >
            <n-spin size="small" />
            <span class="loading-text">{{ t("task.loading") }}</span>
          </div>

          <!-- Empty state -->
          <div
            v-else-if="taskManager.combinedTasks.length === 0"
            class="empty-state"
          >
            <n-icon size="48" :depth="3">
              <component :is="svgIcons.task" />
            </n-icon>
            <p class="empty-text">{{ t("task.noTasks") }}</p>
            <n-button size="small" @click="handleAddFolder">
              {{ t("task.addFolder") }}
            </n-button>
          </div>

          <!-- Task tree -->
          <div v-else class="task-tree">
            <!-- Recent tasks section -->
            <template v-if="taskManager.recentTasks.length > 0">
              <div class="tree-node section-node" @click="toggleNode('recent')">
                <n-icon size="14" class="tree-icon expand-icon">
                  <component
                    :is="
                      isExpanded('recent')
                        ? svgIcons.chevronDown
                        : svgIcons.chevronRight
                    "
                  />
                </n-icon>
                <n-icon size="16" class="tree-icon recent-icon">
                  <component
                    :is="
                      taskManager.recentSortMode === 'time'
                        ? svgIcons.clock
                        : svgIcons.chart
                    "
                  />
                </n-icon>
                <span class="tree-label section-label">{{
                  taskManager.recentSortMode === "time"
                    ? t("task.recent")
                    : t("task.frequent")
                }}</span>
                <span class="tree-badge">{{
                  taskManager.recentTasks.length
                }}</span>
                <n-tooltip trigger="hover" placement="top">
                  <template #trigger>
                    <n-button
                      size="tiny"
                      quaternary
                      class="sort-toggle-btn"
                      @click.stop="taskManager.toggleRecentSortMode()"
                    >
                      <template #icon>
                        <n-icon size="12">
                          <component :is="svgIcons.refresh" />
                        </n-icon>
                      </template>
                    </n-button>
                  </template>
                  {{
                    taskManager.recentSortMode === "time"
                      ? t("task.switchToFrequency")
                      : t("task.switchToTime")
                  }}
                </n-tooltip>
              </div>

              <template v-if="isExpanded('recent')">
                <TaskNode
                  v-for="task in taskManager.recentTasks"
                  :key="`recent-${task.id}`"
                  :task="task"
                  :is-running="taskManager.isTaskRunning(task.id)"
                  :is-favorite="taskManager.isFavorite(task.id)"
                  :show-icon="settingsStore.settings.showTaskIcons"
                  :show-edit="true"
                  :folder-hint="getFavoriteFolderLabel(task)"
                  node-class="recent-task-node"
                  @click="handleTaskClick"
                  @run="handleTaskRun"
                  @stop="handleTaskStop"
                  @edit="handleTaskEditVisual"
                  @toggle-favorite="handleToggleFavorite"
                />
              </template>

              <div class="section-divider"></div>
            </template>

            <!-- Favorites section -->
            <template v-if="taskManager.favoriteTasks.length > 0">
              <div
                class="tree-node section-node"
                @click="toggleNode('favorites')"
              >
                <n-icon size="14" class="tree-icon expand-icon">
                  <component
                    :is="
                      isExpanded('favorites')
                        ? svgIcons.chevronDown
                        : svgIcons.chevronRight
                    "
                  />
                </n-icon>
                <n-icon size="16" class="tree-icon star-icon">
                  <component :is="svgIcons.star" />
                </n-icon>
                <span class="tree-label section-label">{{
                  t("task.favorites")
                }}</span>
                <span class="tree-badge">{{
                  taskManager.favoriteTasks.length
                }}</span>
              </div>

              <template v-if="isExpanded('favorites')">
                <TaskNode
                  v-for="(task, index) in taskManager.favoriteTasks"
                  :key="`fav-${task.id}`"
                  :task="task"
                  :is-running="taskManager.isTaskRunning(task.id)"
                  :is-favorite="true"
                  :show-icon="settingsStore.settings.showTaskIcons"
                  :show-edit="true"
                  :show-favorite="true"
                  :folder-hint="getFavoriteFolderLabel(task)"
                  :is-dragging="
                    isDraggingFavorite && favoriteDraggedIndex === index
                  "
                  :drag-position="
                    favoriteDragOverIndex === index
                      ? favoriteDragPosition
                      : null
                  "
                  node-class="favorite-task-node"
                  @click="handleTaskClick"
                  @run="handleTaskRun"
                  @stop="handleTaskStop"
                  @edit="handleTaskEditVisual"
                  @toggle-favorite="handleToggleFavorite"
                  @mousedown="
                    (event: MouseEvent) =>
                      handleFavoriteMouseDown(event, task, index)
                  "
                />
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
                  <component
                    :is="
                      isExpanded(`group:${group.id}`)
                        ? svgIcons.chevronDown
                        : svgIcons.chevronRight
                    "
                  />
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
                <TaskNode
                  v-for="task in group.tasks"
                  :key="task.id"
                  :task="task"
                  :is-running="taskManager.isTaskRunning(task.id)"
                  :is-favorite="taskManager.isFavorite(task.id)"
                  :show-icon="settingsStore.settings.showTaskIcons"
                  :show-edit="true"
                  :show-favorite="true"
                  :show-delete="true"
                  :draggable="true"
                  node-class="group-task-node"
                  @click="handleTaskClick"
                  @run="handleTaskRun"
                  @stop="handleTaskStop"
                  @edit="handleTaskEditVisual"
                  @delete="handleDeleteUserTask"
                  @toggle-favorite="handleToggleFavorite"
                  @dragstart="handleDragStart"
                  @dragend="handleDragEnd"
                />
              </template>
            </template>

            <!-- Divider between groups and folders -->
            <div
              v-if="taskManager.treeItems.length > 0"
              class="section-divider"
            ></div>

            <!-- Folder tree -->
            <template v-for="folder in taskManager.treeItems" :key="folder.id">
              <!-- Folder node -->
              <div
                class="tree-node folder-node"
                :class="{ 'has-error': folder.hasError }"
                @click="toggleNode(folder.id)"
              >
                <n-icon size="14" class="tree-icon expand-icon">
                  <component
                    :is="
                      isExpanded(folder.id)
                        ? svgIcons.chevronDown
                        : svgIcons.chevronRight
                    "
                  />
                </n-icon>
                <n-icon size="16" class="tree-icon folder-icon">
                  <component :is="svgIcons.folder" />
                </n-icon>

                <!-- Error tooltip -->
                <n-tooltip
                  v-if="folder.hasError"
                  trigger="hover"
                  placement="top"
                  :style="{ maxWidth: '300px' }"
                >
                  <template #trigger>
                    <n-icon
                      size="14"
                      class="tree-icon error-icon"
                      color="#d03050"
                    >
                      <component :is="svgIcons.warning" />
                    </n-icon>
                  </template>
                  {{ folder.errorMessage }}
                </n-tooltip>

                <span
                  class="tree-label"
                  :class="{ 'error-label': folder.hasError }"
                  >{{ folder.label }}</span
                >
                <div class="folder-actions">
                  <n-tooltip trigger="hover" :delay="500">
                    <template #trigger>
                      <n-button
                        size="tiny"
                        quaternary
                        :loading="taskManager.isScanning"
                        @click.stop="
                          handleScanFolder(folder.id.replace('folder:', ''))
                        "
                      >
                        <template #icon>
                          <n-icon size="14">
                            <component :is="svgIcons.refresh" />
                          </n-icon>
                        </template>
                      </n-button>
                    </template>
                    {{ t("task.scan") }}
                  </n-tooltip>
                  <n-tooltip v-if="isDesktopMode" trigger="hover" :delay="500">
                    <template #trigger>
                      <n-button
                        size="tiny"
                        quaternary
                        @click.stop="
                          handleOpenInExplorer(folder.id.replace('folder:', ''))
                        "
                      >
                        <template #icon>
                          <n-icon size="14">
                            <component :is="svgIcons.externalLink" />
                          </n-icon>
                        </template>
                      </n-button>
                    </template>
                    {{ t("task.openInExplorer") }}
                  </n-tooltip>
                  <n-button
                    size="tiny"
                    quaternary
                    @click.stop="
                      handleRemoveFolder(folder.id.replace('folder:', ''))
                    "
                  >
                    <template #icon>
                      <n-icon size="14">
                        <component :is="svgIcons.close" />
                      </n-icon>
                    </template>
                  </n-button>
                </div>
              </div>

              <!-- Children nodes (subfolder or source) -->
              <template v-if="isExpanded(folder.id)">
                <template v-for="child in folder.children" :key="child.id">
                  <!-- Subfolder node -->
                  <template v-if="child.type === 'subfolder'">
                    <div
                      class="tree-node subfolder-node"
                      @click="toggleNode(child.id)"
                    >
                      <n-icon size="14" class="tree-icon expand-icon">
                        <component
                          :is="
                            isExpanded(child.id)
                              ? svgIcons.chevronDown
                              : svgIcons.chevronRight
                          "
                        />
                      </n-icon>
                      <n-icon
                        size="16"
                        class="tree-icon folder-icon subfolder-icon"
                      >
                        <component :is="svgIcons.folder" />
                      </n-icon>
                      <span class="tree-label">{{ child.label }}</span>
                      <span class="tree-badge">{{
                        getChildTaskCount(child)
                      }}</span>
                      <div v-if="isDesktopMode" class="subfolder-actions">
                        <n-tooltip trigger="hover" :delay="500">
                          <template #trigger>
                            <n-button
                              size="tiny"
                              quaternary
                              @click.stop="
                                handleOpenInExplorer(
                                  getSubfolderPath(
                                    folder.id,
                                    child.relativePath,
                                  ),
                                )
                              "
                            >
                              <template #icon>
                                <n-icon size="14">
                                  <component :is="svgIcons.externalLink" />
                                </n-icon>
                              </template>
                            </n-button>
                          </template>
                          {{ t("task.openInExplorer") }}
                        </n-tooltip>
                      </div>
                    </div>

                    <!-- Source nodes inside subfolder -->
                    <template v-if="isExpanded(child.id)">
                      <template
                        v-for="source in child.children"
                        :key="source.id"
                      >
                        <div
                          class="tree-node source-node subfolder-source-node"
                          @click="toggleNode(source.id)"
                        >
                          <n-icon size="14" class="tree-icon expand-icon">
                            <component
                              :is="
                                isExpanded(source.id)
                                  ? svgIcons.chevronDown
                                  : svgIcons.chevronRight
                              "
                            />
                          </n-icon>
                          <n-icon size="16" class="tree-icon source-icon">
                            <component :is="getSourceIcon(source.icon)" />
                          </n-icon>
                          <span class="tree-label">{{ source.label }}</span>
                          <span class="tree-badge">{{
                            source.children?.length || 0
                          }}</span>
                        </div>

                        <!-- Task nodes inside subfolder source -->
                        <template v-if="isExpanded(source.id)">
                          <TaskNode
                            v-for="taskItem in source.children"
                            :key="taskItem.id"
                            :task="taskItem.task!"
                            :is-running="
                              taskManager.isTaskRunning(taskItem.task!.id)
                            "
                            :is-favorite="
                              taskManager.isFavorite(taskItem.task!.id)
                            "
                            :show-icon="settingsStore.settings.showTaskIcons"
                            node-class="subfolder-task-node"
                            @click="handleTaskClick"
                            @run="handleTaskRun"
                            @stop="handleTaskStop"
                            @edit="handleTaskEditVisual"
                            @toggle-favorite="handleToggleFavorite"
                          />
                        </template>
                      </template>
                    </template>
                  </template>

                  <!-- Source node (direct child of folder) -->
                  <template v-else-if="child.type === 'source'">
                    <div
                      class="tree-node source-node"
                      @click="toggleNode(child.id)"
                    >
                      <n-icon size="14" class="tree-icon expand-icon">
                        <component
                          :is="
                            isExpanded(child.id)
                              ? svgIcons.chevronDown
                              : svgIcons.chevronRight
                          "
                        />
                      </n-icon>
                      <n-icon size="16" class="tree-icon source-icon">
                        <component :is="getSourceIcon(child.icon)" />
                      </n-icon>
                      <span class="tree-label">{{ child.label }}</span>
                      <span class="tree-badge">{{
                        child.children?.length || 0
                      }}</span>
                      <div class="source-actions">
                        <n-tooltip trigger="hover" :delay="500">
                          <template #trigger>
                            <n-button
                              size="tiny"
                              quaternary
                              :loading="taskManager.isScanning"
                              @click.stop="
                                handleScanFolder(getSourceFolderPath(child.id))
                              "
                            >
                              <template #icon>
                                <n-icon size="14">
                                  <component :is="svgIcons.refresh" />
                                </n-icon>
                              </template>
                            </n-button>
                          </template>
                          {{ t("task.scan") }}
                        </n-tooltip>
                        <n-tooltip
                          v-if="isDesktopMode"
                          trigger="hover"
                          :delay="500"
                        >
                          <template #trigger>
                            <n-button
                              size="tiny"
                              quaternary
                              @click.stop="
                                handleOpenInExplorer(
                                  getSourceFolderPath(child.id),
                                )
                              "
                            >
                              <template #icon>
                                <n-icon size="14">
                                  <component :is="svgIcons.externalLink" />
                                </n-icon>
                              </template>
                            </n-button>
                          </template>
                          {{ t("task.openInExplorer") }}
                        </n-tooltip>
                      </div>
                    </div>

                    <!-- Task nodes -->
                    <template v-if="isExpanded(child.id)">
                      <TaskNode
                        v-for="taskItem in child.children"
                        :key="taskItem.id"
                        :task="taskItem.task!"
                        :is-running="
                          taskManager.isTaskRunning(taskItem.task!.id)
                        "
                        :is-favorite="taskManager.isFavorite(taskItem.task!.id)"
                        :show-icon="settingsStore.settings.showTaskIcons"
                        @click="handleTaskClick"
                        @run="handleTaskRun"
                        @stop="handleTaskStop"
                        @edit="handleTaskEditVisual"
                        @toggle-favorite="handleToggleFavorite"
                      />
                    </template>
                  </template>
                </template>
              </template>
            </template>
          </div>
        </n-scrollbar>
      </div>
    </div>
  </n-layout-sider>

  <!-- Dialogs -->
  <TaskEditDialog
    v-model:show="showTaskDialog"
    :is-edit-mode="isEditMode"
    :is-user-task="isUserTask"
    :task="editingTask"
    :group-id="editingTaskGroupId"
    :group-options="userGroupOptions"
    @update:task="editingTask = $event"
    @update:group-id="editingTaskGroupId = $event"
    @save="handleSaveTask"
  />

  <RenameGroupDialog
    v-model:show="showRenameGroupDialog"
    :group-id="renameGroupData.groupId"
    :group-name="renameGroupData.newName"
    @confirm="handleConfirmRenameGroup"
  />

  <AddFolderDialog
    v-model:show="showAddFolderDialog"
    :group-options="userGroupOptions"
    @confirm="handleConfirmAddFolder"
  />

  <TaskSelectionDialog
    v-model:show="showTaskSelectionDialog"
    :tasks="scannedTasks"
    :duplicate-task-names="duplicateTaskNames"
    @confirm="handleConfirmImport"
  />

  <AICollabNativeCreateDialog
    v-model:show="showAICollabNativeDialog"
    :group-options="userGroupOptions"
    @created="handleAICollabCreated"
  />

  <AICollabTaskEditDialog
    v-model:show="showAICollabEditDialog"
    :task="editingAITask"
    @save="handleSaveAITask"
  />

  <DualAgentCreateDialog v-model:show="showDualAgentDialog" />

  <ResumeSessionDialog
    v-model:show="showResumeDialog"
    :boulder-state="pendingBoulderState"
    @resume="handleResumeSession"
    @start-new="handleStartNewSession"
  />
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, reactive } from "vue";
import {
  NLayoutSider,
  NButton,
  NScrollbar,
  NTooltip,
  NIcon,
  NSpin,
  NInput,
} from "naive-ui";
import { useI18n } from "vue-i18n";
import { getAdapter, isTauri } from "../adapters";
import { useUIStore } from "../stores/ui";
import { useTaskManagerStore } from "../stores/taskManager";
import { useSettingsStore } from "../stores/settings";
import { useUpdaterStore } from "../stores/updater";
import { useTerminalStore } from "../stores/terminal";
import { useDualAgentStore } from "../stores/dualAgent";
import { useNotificationStore } from "../stores/notification";
import { useTheme } from "../composables/useTheme";
import { svgIcons } from "../utils/icons";
import type { Task, TaskGroup, TaskTreeItem } from "../providers/types";
import { TaskType } from "../providers/types";

// Sub-components

import TaskNode from "./sidebar/TaskNode.vue";
import {
  TaskEditDialog,
  AddFolderDialog,
  TaskSelectionDialog,
  RenameGroupDialog,
  AICollabNativeCreateDialog,
  AICollabTaskEditDialog,
  DualAgentCreateDialog,
} from "./sidebar/dialogs";
import ResumeSessionDialog from "./sidebar/dialogs/ResumeSessionDialog.vue";
import type { BoulderStateInfo } from "../adapters/types";
import type { AddFolderFormData } from "./sidebar/dialogs";

const { t } = useI18n();
const uiStore = useUIStore();
const taskManager = useTaskManagerStore();
const settingsStore = useSettingsStore();
const updaterStore = useUpdaterStore();
const terminalStore = useTerminalStore();
const notificationStore = useNotificationStore();
const dualAgentStore = useDualAgentStore();
const { effectiveTheme } = useTheme();

// Check if running in Tauri (desktop) mode
const isDesktopMode = isTauri();

const isResizing = ref(false);
const resizeStartX = ref(0);
const resizeStartWidth = ref(0);

const clampSidebarWidth = (width: number) =>
  Math.min(420, Math.max(200, Math.round(width)));

const syncMiniModeWindowWidth = async (width?: number) => {
  if (!uiStore.miniMode || !isDesktopMode) return;
  try {
    const { getCurrentWindow, LogicalSize } = await import(
      "@tauri-apps/api/window"
    );
    const appWindow = getCurrentWindow();
    const targetWidth = clampSidebarWidth(width ?? uiStore.sidebarWidth);
    const scaleFactor = await appWindow.scaleFactor();
    const currentSize = await appWindow.innerSize();
    const logicalHeight = Math.max(400, currentSize.height / scaleFactor || 600);
    await appWindow.setMinSize(new LogicalSize(targetWidth, 400));
    await appWindow.setSize(new LogicalSize(targetWidth, logicalHeight));
  } catch (error) {
    console.error("[MiniMode] Failed to sync mini width:", error);
  }
};

const handleResizeMouseMove = (event: MouseEvent) => {
  if (!isResizing.value) return;
  const deltaX = event.clientX - resizeStartX.value;
  uiStore.sidebarWidth = clampSidebarWidth(resizeStartWidth.value + deltaX);
};

const handleResizeMouseUp = async () => {
  if (!isResizing.value) return;
  isResizing.value = false;
  document.removeEventListener("mousemove", handleResizeMouseMove);
  document.removeEventListener("mouseup", handleResizeMouseUp);
  document.body.style.cursor = "";
  document.body.style.userSelect = "";
  await syncMiniModeWindowWidth();
};

const handleResizeMouseDown = (event: MouseEvent) => {
  if (event.button !== 0) return;
  isResizing.value = true;
  resizeStartX.value = event.clientX;
  resizeStartWidth.value = uiStore.sidebarWidth;
  document.addEventListener("mousemove", handleResizeMouseMove);
  document.addEventListener("mouseup", handleResizeMouseUp);
  document.body.style.cursor = "col-resize";
  document.body.style.userSelect = "none";
};

// Search state
const searchQuery = ref("");
const filteredTasks = computed(() => {
  const query = searchQuery.value.trim().toLowerCase();
  if (!query) return [];

  return taskManager.combinedTasks.filter(
    (task) =>
      task.name.toLowerCase().includes(query) ||
      (task.command && task.command.toLowerCase().includes(query)),
  );
});

// Expanded nodes state
const expandedNodes = ref<Set<string>>(new Set());

// Task dialog state
const showTaskDialog = ref(false);
const isEditMode = ref(false);
const isUserTask = ref(false);
const editingTaskGroupId = ref("default");
const editingTask = ref<{
  id: string;
  name: string;
  command: string;
  cwd: string;
  group: TaskGroup;
  type: TaskType;
  sourceFile: string;
  useSystemTerminal: boolean;
  systemTerminalId?: string | null;
  shellPath?: string | null;
  envStr: string;
  pythonEnv?: string;
  runAsAdmin?: boolean;
  executionMode?: "serial" | "parallel";
  dependsOn?: string[];
  subTasks?: string[];
  // SSH remote execution fields
  useSsh?: boolean;
  sshConfigId?: string | null;
  sshPassphrase?: string;
}>({
  id: "",
  name: "",
  command: "",
  cwd: "",
  group: "none" as TaskGroup,
  type: TaskType.SHELL,
  sourceFile: "",
  useSystemTerminal: false,
  systemTerminalId: null,
  shellPath: null,
  envStr: "",
  pythonEnv: "",
  runAsAdmin: false,
});

// Add folder dialog state
const showAddFolderDialog = ref(false);
const showTaskSelectionDialog = ref(false);
const scannedTasks = ref<Task[]>([]);
const addFolderFormData = ref<AddFolderFormData | null>(null);

// Rename group dialog state
const showRenameGroupDialog = ref(false);
const renameGroupData = reactive({
  groupId: "",
  newName: "",
});

// AI Collab Native dialog state
const showAICollabNativeDialog = ref(false);
const showAICollabEditDialog = ref(false);
const editingAITask = ref<Task | null>(null);

// Dual Agent dialog state
const showDualAgentDialog = ref(false);

// Drag and drop state
const draggedTask = ref<Task | null>(null);
const dragOverGroupId = ref<string | null>(null);

// Favorite drag and drop state
const favoriteDraggedIndex = ref<number>(-1);
const favoriteDragOverIndex = ref<number>(-1);
const favoriteDragPosition = ref<"top" | "bottom" | null>(null);
const isDraggingFavorite = ref(false);

// User group options for select
const userGroupOptions = computed(() =>
  taskManager.userGroups.map((g) => ({
    label: g.name,
    value: g.id,
  })),
);

// Duplicate task names for selection dialog
const duplicateTaskNames = computed(() => {
  if (!addFolderFormData.value) return [];
  const targetGroupId =
    addFolderFormData.value.targetGroupId === "__new__"
      ? null
      : addFolderFormData.value.targetGroupId;
  if (!targetGroupId) return [];

  const group = taskManager.userGroups.find((g) => g.id === targetGroupId);
  if (!group) return [];

  return group.tasks.map((t) => t.name);
});

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
    case "vscode":
      return svgIcons.vscode || svgIcons.task;
    case "npm":
      return svgIcons.npm || svgIcons.task;
    default:
      return svgIcons.task;
  }
};

// Get total task count for a subfolder node
const getChildTaskCount = (node: TaskTreeItem): number => {
  if (!node.children || node.children.length === 0) return 0;

  let count = 0;
  for (const child of node.children) {
    if (child.type === "task") {
      count++;
    } else if (child.children) {
      count += getChildTaskCount(child);
    }
  }
  return count;
};

// Get full path for subfolder
const getSubfolderPath = (folderId: string, relativePath?: string): string => {
  const folderPath = folderId.replace("folder:", "");
  if (!relativePath) return folderPath;
  return `${folderPath}/${relativePath}`;
};

// Get folder label for favorite tasks
const getFavoriteFolderLabel = (task: Task): string | null => {
  if (task.source === "user") return null;
  const path = task.sourceFile || task.cwd;
  if (!path) return null;

  const parts = path.split(/[/\\]/);
  if (task.sourceFile) {
    const idx = parts.findIndex(
      (p) => p === ".vscode" || p === "package.json" || p === "tasks.json",
    );
    if (idx > 0) return parts[idx - 1];
    const nonEmpty = parts.filter((p) => p);
    return nonEmpty.length >= 2 ? nonEmpty[nonEmpty.length - 2] : null;
  } else {
    const nonEmpty = parts.filter((p) => p);
    return nonEmpty.length > 0 ? nonEmpty[nonEmpty.length - 1] : null;
  }
};

// Get folder path from source id
const getSourceFolderPath = (sourceId: string): string => {
  const parts = sourceId.split(":");
  if (parts.length >= 3) {
    return parts.slice(1, -1).join(":");
  }
  return "";
};

// Handle add folder
const handleAddFolder = () => {
  showAddFolderDialog.value = true;
};

// Handle confirm add folder

const handleConfirmAddFolder = async (data: AddFolderFormData) => {
  addFolderFormData.value = data;

  if (data.isImportMode) {
    try {
      const tasks = await taskManager.scanFolderForTasks(data.sourceFolder);
      scannedTasks.value = tasks;
      showAddFolderDialog.value = false;
      showTaskSelectionDialog.value = true;
    } catch (error) {
      console.error("[TaskSidebar] Failed to scan folder for tasks:", error);
    }
  } else {
    try {
      await taskManager.addFolder(data.sourceFolder);
    } catch (error) {
      console.error("[TaskSidebar] Failed to add folder:", error);
    }
  }
};

// Handle confirm import
const handleConfirmImport = async (selectedTaskIds: string[]) => {
  if (selectedTaskIds.length === 0 || !addFolderFormData.value) return;

  try {
    let targetGroupId = addFolderFormData.value.targetGroupId;

    if (
      targetGroupId === "__new__" &&
      addFolderFormData.value.newGroupName.trim()
    ) {
      const newGroup = await taskManager.createUserGroup(
        addFolderFormData.value.newGroupName.trim(),
      );
      targetGroupId = newGroup.id;
    }

    const tasksToImport = scannedTasks.value.filter((t) =>
      selectedTaskIds.includes(t.id),
    );
    const importedCount = await taskManager.importTasksToGroupWithOverwrite(
      targetGroupId,
      tasksToImport,
    );
    console.log(`[TaskSidebar] Imported ${importedCount} tasks`);

    expandedNodes.value.add(`group:${targetGroupId}`);
    showTaskSelectionDialog.value = false;
  } catch (error) {
    console.error("[TaskSidebar] Failed to import:", error);
  }
};

// Handle remove folder
const handleRemoveFolder = (folderPath: string) => {
  taskManager.removeFolder(folderPath);
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
      const adapter = await getAdapter();
      // Pass path directly, adapter should handle it
      await adapter.system.openExternal(folderPath);
    } catch (error) {
      notificationStore.addError(
        t("task.openInExplorerFailed") || "Failed to open folder",
        String(error),
        "system",
      );
      console.error("[TaskSidebar] Failed to open folder:", error);
    }
  }
};

// Handle delete user group
const handleDeleteGroup = async (groupId: string) => {
  await taskManager.deleteUserGroup(groupId);
};

// Handle rename group
const handleRenameGroup = (group: { id: string; name: string }) => {
  renameGroupData.groupId = group.id;
  renameGroupData.newName = group.name;
  showRenameGroupDialog.value = true;
};

// Handle confirm rename group
const handleConfirmRenameGroup = async (groupId: string, newName: string) => {
  await taskManager.renameUserGroup(groupId, newName);
  showRenameGroupDialog.value = false;
};

// Drag and drop handlers
const handleDragStart = (event: DragEvent, task: Task) => {
  draggedTask.value = task;
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", task.id);
  }
};

const handleDragEnd = () => {
  draggedTask.value = null;
  dragOverGroupId.value = null;
};

const handleDragOver = (event: DragEvent, groupId: string) => {
  event.preventDefault();
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = "move";
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
    expandedNodes.value.add(`group:${targetGroupId}`);
  }
  draggedTask.value = null;
};

// Favorite reorder handlers
const handleFavoriteMouseDown = (
  event: MouseEvent,
  _task: Task,
  index: number,
) => {
  if (event.button !== 0) return;
  const target = event.target as HTMLElement;
  if (target.closest(".task-actions-float")) return;

  favoriteDraggedIndex.value = index;
  isDraggingFavorite.value = false;

  document.addEventListener("mousemove", handleFavoriteMouseMove);
  document.addEventListener("mouseup", handleFavoriteMouseUp);
};

const handleFavoriteMouseMove = (event: MouseEvent) => {
  if (favoriteDraggedIndex.value === -1) return;

  if (!isDraggingFavorite.value) {
    isDraggingFavorite.value = true;
  }

  const favoriteNodes = document.querySelectorAll(".favorite-task-node");
  let foundIndex = -1;
  let position: "top" | "bottom" | null = null;

  favoriteNodes.forEach((node, idx) => {
    if (!node || !(node instanceof Element)) return;
    const rect = node.getBoundingClientRect();
    if (event.clientY >= rect.top && event.clientY <= rect.bottom) {
      foundIndex = idx;
      const midY = rect.top + rect.height / 2;
      position = event.clientY < midY ? "top" : "bottom";
    }
  });

  favoriteDragOverIndex.value = foundIndex;
  favoriteDragPosition.value = position;
};

const handleFavoriteMouseUp = async () => {
  document.removeEventListener("mousemove", handleFavoriteMouseMove);
  document.removeEventListener("mouseup", handleFavoriteMouseUp);

  if (!isDraggingFavorite.value || favoriteDraggedIndex.value === -1) {
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
    if (favoriteDragPosition.value === "bottom") {
      toIndex = targetIndex + 1;
    }
    if (fromIndex < toIndex) {
      toIndex -= 1;
    }

    if (fromIndex !== toIndex) {
      await taskManager.reorderFavorites(fromIndex, toIndex);
    }
  }

  favoriteDraggedIndex.value = -1;
  favoriteDragOverIndex.value = -1;
  favoriteDragPosition.value = null;
  isDraggingFavorite.value = false;
};

// Handle delete user task
const handleDeleteUserTask = async (task: Task) => {
  await taskManager.removeTaskFromGroup(task.id);
};

// Handle add task
const handleAddTask = () => {
  isEditMode.value = false;
  isUserTask.value = true;
  editingTaskGroupId.value = "default";
  editingTask.value = {
    id: "",
    name: "",
    command: "",
    cwd: "",
    group: "none",
    type: TaskType.SHELL,
    sourceFile: "",
    useSystemTerminal: false,
    systemTerminalId: null,
    shellPath: null,
    envStr: "",
    pythonEnv: "",
    runAsAdmin: false,
    // Macro task fields (initialized for new tasks)
    executionMode: undefined,
    dependsOn: undefined,
    subTasks: undefined,
    // SSH fields
    useSsh: false,
    sshConfigId: null,
  };
  showTaskDialog.value = true;
};

// Handle port management - create tab instead of dialog
const handlePortManagement = () => {
  terminalStore.createPortManagementTab();
};

// Handle AI collaboration Native - show AI collab native create dialog
const handleAICollabNative = () => {
  showAICollabNativeDialog.value = true;
};

// Handle task visual edit
const handleTaskEditVisual = (task: Task) => {
  // If it is an AI Collab task, open the dedicated AI Collab edit dialog
  if (task.type === TaskType.AI_COLLAB) {
    editingAITask.value = task;
    showAICollabEditDialog.value = true;
    return;
  }

  isEditMode.value = true;
  isUserTask.value = task.source === "user";
  const group = taskManager.userGroups.find((g) =>
    g.tasks.some((t) => t.id === task.id),
  );
  editingTaskGroupId.value = group?.id || "default";

  let envStr = "";
  if (task.env) {
    envStr = Object.entries(task.env)
      .map(([key, value]) => `${key}=${value}`)
      .join("\n");
  }

  // Combine command and args into a single command string
  const fullCommand = task.args?.length
    ? `${task.command} ${task.args.join(" ")}`
    : task.command || ""; // Default to empty string for macro tasks

  editingTask.value = {
    id: task.id,
    name: task.name,
    command: fullCommand,
    cwd: task.cwd || "",
    group: task.group || "none",
    type: (task.type || TaskType.SHELL) as TaskType,
    sourceFile: task.sourceFile || "",
    useSystemTerminal: task.useSystemTerminal || false,
    systemTerminalId: task.systemTerminalId || null,
    shellPath: task.shellPath || null,
    envStr,
    // Macro task fields
    executionMode: task.executionMode,
    dependsOn: task.dependsOn,
    subTasks: task.subTasks,
    // Other fields
    pythonEnv: task.pythonEnv || "",
    runAsAdmin: task.runAsAdmin || false,
    // SSH fields - use sshConfigId if available, otherwise check legacy definition.ssh
    useSsh: !!task.sshConfigId || !!task.definition?.ssh,
    sshConfigId: task.sshConfigId || null,
  };
  showTaskDialog.value = true;
};

// Handle save task
const handleSaveTask = async (
  task: any,
  groupId: string,
  newGroupName: string,
) => {
  try {
    let env: Record<string, string> | undefined;
    if (task.envStr.trim()) {
      env = {};
      const lines = task.envStr.split("\n");
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const eqIndex = trimmed.indexOf("=");
        if (eqIndex > 0) {
          const key = trimmed.substring(0, eqIndex).trim();
          const value = trimmed.substring(eqIndex + 1).trim();
          if (key) env[key] = value;
        }
      }
      if (Object.keys(env).length === 0) env = undefined;
    }

    let targetGroupId = groupId;
    if (isUserTask.value && groupId === "__new__" && newGroupName.trim()) {
      const newGroup = await taskManager.createUserGroup(newGroupName.trim());
      targetGroupId = newGroup.id;
    }

    // Prepare task data with macro task support
    const taskData: any = {
      name: task.name,
      command: task.command,
      args: undefined, // Clear args since command now contains full command line
      group: task.group,
      type: task.type,
      cwd: task.cwd,
      useSystemTerminal: task.useSystemTerminal,
      systemTerminalId: task.systemTerminalId,
      shellPath: task.shellPath,
      pythonEnv: task.pythonEnv,
      runAsAdmin: task.runAsAdmin,
      env,
    };

    // Add macro task fields if it's a macro task
    if (task.type === "macro") {
      taskData.executionMode = task.executionMode;
      if (task.executionMode === "parallel") {
        taskData.subTasks = task.subTasks;
        taskData.dependsOn = undefined;
      } else {
        taskData.dependsOn = task.dependsOn;
        taskData.subTasks = undefined;
      }
    }

    // Add SSH configuration ID if enabled
    if (task.useSsh && task.sshConfigId) {
      taskData.sshConfigId = task.sshConfigId;
    } else {
      // Clear SSH config ID if disabled
      taskData.sshConfigId = null;

      // Also clear legacy SSH config in definition if present
      if (taskData.definition?.ssh) {
        delete taskData.definition.ssh;
      }
    }

    if (isEditMode.value && isUserTask.value && task.id) {
      await taskManager.updateTaskInGroup(task.id, taskData);
      const currentGroup = taskManager.userGroups.find((g) =>
        g.tasks.some((t) => t.id === task.id),
      );
      if (currentGroup && currentGroup.id !== targetGroupId) {
        await taskManager.moveTaskToGroup(task.id, targetGroupId);
      }
    } else if (isUserTask.value) {
      await taskManager.addTaskToGroup(targetGroupId, taskData);
      expandedNodes.value.add(`group:${targetGroupId}`);
    } else if (taskManager.folders.length > 0) {
      const folderPath = task.cwd || taskManager.folders[0].path;
      await taskManager.addUserTask(folderPath, taskData);
    }

    showTaskDialog.value = false;
  } catch (error) {
    console.error("[TaskSidebar] Failed to save task:", error);
  }
};

// Handle saving AI Task
const handleSaveAITask = async (taskData: any) => {
  if (!editingAITask.value || !editingAITask.value.id) return;

  try {
    await taskManager.updateTaskInGroup(editingAITask.value.id, taskData);
    showAICollabEditDialog.value = false;
    editingAITask.value = null;
  } catch (error) {
    console.error("[TaskSidebar] Failed to save AI task:", error);
    notificationStore.addError(
      t("common.saveFailed") || "Failed to save",
      String(error),
      "frontend",
    );
  }
};

// Handle AI collab task created
const handleAICollabCreated = (sessionId: string, taskId: string) => {
  console.log("[TaskSidebar] AI collab task created:", { sessionId, taskId });
  // The task is already added to the group in the dialog
  // Just need to ensure the UI updates
};

// Handle task click
const handleTaskClick = (task: Task) => {
  console.log("[TaskSidebar] Task clicked:", task.name);

  // For AI collab tasks, switch to the AI collab tab
  if (task.type === "ai-collab" && task.definition?.sessionId) {
    const sessionId = task.definition.sessionId as string;
    // Check if a tab exists for this session
    const existingTab = terminalStore.tabs.find(
      (t) => t.collabSessionId === sessionId,
    );
    if (existingTab) {
      terminalStore.setActiveTab(existingTab.id);
    } else {
      // Create a new AI collab tab
      terminalStore.createAICollabNativeTab(
        sessionId,
        task.name || "AI 协作",
        task.cwd,
      );
    }
  }
};

// Resume session dialog state
const showResumeDialog = ref(false);
const pendingBoulderState = ref<BoulderStateInfo | null>(null);
const pendingTask = ref<Task | null>(null);

// Handle task run
const handleTaskRun = async (task: Task) => {
  try {
    console.log("[TaskSidebar] handleTaskRun called:", task.name, task.type);
    // For AI collab tasks, switch to the AI collab tab
    if (task.type === TaskType.AI_COLLAB && task.definition?.sessionId) {
      const sessionId = task.definition.sessionId as string;
      const existingSession = dualAgentStore.getSession(sessionId);
      if (existingSession) {
        // Check if a tab exists for this session
        const existingTab = terminalStore.tabs.find(
          (t) => t.collabSessionId === sessionId,
        );
        if (existingTab) {
          terminalStore.setActiveTab(existingTab.id);
        } else {
          // Create a new dual agent tab
          terminalStore.createDualAgentTab(
            sessionId,
            task.name || "AI 协作",
            task.cwd,
          );
        }
        return;
      }
    }

    // For AI collab tasks, check for boulder state before creating new session
    if (task.type === TaskType.AI_COLLAB && isDesktopMode) {
      const projectPath = task.cwd || "";
      if (projectPath) {
        try {
          const adapter = await getAdapter();
          const boulderState =
            await adapter.orchestration.checkBoulderState(projectPath);
          if (boulderState?.exists) {
            // Show resume dialog
            pendingBoulderState.value = boulderState;
            pendingTask.value = task;
            showResumeDialog.value = true;
            return;
          }
        } catch (error) {
          console.warn("[TaskSidebar] Failed to check boulder state:", error);
        }
      }
    }

    console.log("[TaskSidebar] Calling executeTask for:", task.name);
    await taskManager.executeTask(task);
  } catch (error) {
    console.error("[TaskSidebar] Failed to run task:", error);
  }
};

// Handle resume session
const handleResumeSession = async () => {
  if (!pendingTask.value || !pendingBoulderState.value) return;

  try {
    const task = pendingTask.value;
    const boulderState = pendingBoulderState.value;

    // Create session with the goal from boulder state

    // Get provider config
    const { PROVIDER_CONFIG } = await import("../services/ai/provider/models");
    const providerType = "opencode" as const;
    const defaultProviderConfig = PROVIDER_CONFIG[providerType];
    const providerConfig = {
      type: providerType,
      model: "minimax-m2.1-free",
      apiKey: "",
      baseUrl: defaultProviderConfig?.baseUrl,
    };

    const session = await dualAgentStore.createSession({
      projectPath: task.cwd || "",
      goal: {
        ...boulderState.goal,
        objective:
          boulderState.goal?.objective || task.name || "执行 AI 协作任务",
        taskName: task.name,
        acceptanceCriteria:
          boulderState.goal?.acceptanceCriteria || ["任务成功完成"],
        context: boulderState.goal?.context || "",
        constraints: boulderState.goal?.constraints,
      },
      supervisorProvider: providerConfig,
      workerProvider: providerConfig,
      workerTools: task.definition?.tools || [
        "read",
        "write",
        "edit",
        "bash",
        "glob",
        "grep",
      ],
      skillsPath: task.definition?.skillsPath,
      maxRounds: task.definition?.maxRounds || 20,
      autoApprovePermissions: true,
    });

    const previousSessionId = task.definition?.sessionId as string | undefined;

    // Load conversation history from previous session if available
    if (boulderState.session_id) {
      try {
        let previousConversation =
          await dualAgentStore.loadConversationFromStorage(
            boulderState.session_id,
          );
        if (
          (!previousConversation || previousConversation.length === 0) &&
          previousSessionId
        ) {
          previousConversation =
            await dualAgentStore.loadConversationFromStorage(previousSessionId);
        }
        if (previousConversation && previousConversation.length > 0) {
          console.log(
            "[TaskSidebar] Loading conversation history from previous session:",
            boulderState.session_id,
            "messages:",
            previousConversation.length,
          );
          // Restore conversation history to the new session
          const currentSession = dualAgentStore.getSession(session.id);
          if (currentSession) {
            currentSession.conversation = previousConversation;
            console.log(
              "[TaskSidebar] Restored conversation history:",
              currentSession.conversation.length,
              "messages",
            );
          }
        }
      } catch (error) {
        console.warn(
          "[TaskSidebar] Failed to load conversation history from previous session:",
          error,
        );
      }
    }

    // Update task with session ID
    task.definition = task.definition || {};
    task.definition.sessionId = session.id;

    // Create dual agent tab
    terminalStore.createDualAgentTab(
      session.id,
      task.name || "AI 协作",
      task.cwd,
    );

    // Start the session (it will automatically resume from boulder state)
    console.log("[TaskSidebar] Resuming dual agent session:", session.id);
    await dualAgentStore.startSession(session.id);

    // Clear pending state
    pendingTask.value = null;
    pendingBoulderState.value = null;
  } catch (error) {
    console.error("[TaskSidebar] Failed to resume session:", error);
    throw error;
  }
};

// Handle start new session
const handleStartNewSession = async () => {
  if (!pendingTask.value) return;

  try {
    const task = pendingTask.value;
    // Clear pending state
    pendingTask.value = null;
    pendingBoulderState.value = null;

    // Execute task normally (will create new session)
    console.log("[TaskSidebar] Starting new session for task:", task.name);
    await taskManager.executeTask(task);
  } catch (error) {
    console.error("[TaskSidebar] Failed to start new session:", error);
    throw error;
  }
};

// Handle task stop
const handleTaskStop = async (task: Task) => {
  try {
    await taskManager.stopTask(task.id);
  } catch (error) {
    console.error("[TaskSidebar] Failed to stop task:", error);
  }
};

// Handle toggle favorite
const handleToggleFavorite = async (task: Task) => {
  await taskManager.toggleFavorite(task.id);
};

// Initialize
onMounted(async () => {
  await updaterStore.autoCheckForUpdates();
  taskManager.scanRecursively = true;
  await taskManager.initialize();

  watch(
    () => taskManager.recentTasks,
    (newVal) => {
      console.log(
        "[TaskSidebar] recentTasks changed:",
        newVal.map((t) => ({ id: t.id, name: t.name })),
      );
    },
    { immediate: true },
  );

  expandedNodes.value.add("favorites");
  expandedNodes.value.add("recent");

  window.addEventListener("add-folder", handleAddFolder);
  window.addEventListener("add-task", handleAddTask);
  window.addEventListener("port-management", handlePortManagement);
  window.addEventListener("ai-collab-native", handleAICollabNative);
});

onUnmounted(() => {
  document.removeEventListener("mousemove", handleResizeMouseMove);
  document.removeEventListener("mouseup", handleResizeMouseUp);
  document.body.style.cursor = "";
  document.body.style.userSelect = "";
  window.removeEventListener("add-folder", handleAddFolder);
  window.removeEventListener("add-task", handleAddTask);
  window.removeEventListener("port-management", handlePortManagement);
  window.removeEventListener("ai-collab-native", handleAICollabNative);
});
</script>

<style scoped>
.sidebar-layout {
  background-color: #1e1e1e;
  border-right: 1px solid rgba(255, 255, 255, 0.1);
  height: 100vh;
  display: flex !important;
  flex-direction: column !important;
  position: relative;
  overflow: visible;
  transition: none !important;
}

:deep(.n-layout-sider) {
  transition: none !important;
}

.light-theme.sidebar-layout {
  background-color: #f5f5f5;
  border-right: 1px solid rgba(0, 0, 0, 0.1);
}

.sidebar-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

.sidebar-resizer {
  position: absolute;
  top: 0;
  right: -4px;
  width: 10px;
  height: 100%;
  cursor: col-resize;
  z-index: 9999;
  background: transparent;
  pointer-events: auto;
  transition: opacity 0.15s ease;
}

.sidebar-resizer.active {
  background: rgba(255, 255, 255, 0.15);
}

.light-theme .sidebar-resizer.active {
  background: rgba(0, 0, 0, 0.15);
}

.sidebar-search {
  padding: 8px 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.light-theme .sidebar-search {
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
}

.task-tree-container {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  position: relative;
  z-index: 0;
}

.task-tree-container :deep(.n-scrollbar) {
  position: relative;
  z-index: 0;
}

.task-tree-container :deep(.n-scrollbar-container) {
  position: relative;
  z-index: 0;
}

.task-tree-container :deep(.n-scrollbar-content) {
  padding-right: 10px;
  padding-bottom: 28px;
}

.task-tree-container :deep(.n-scrollbar-rail) {
  display: none !important;
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 16px;
  text-align: center;
  gap: 12px;
}

.loading-text {
  color: rgba(255, 255, 255, 0.5);
  font-size: 13px;
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

.task-tree {
  padding: 8px 0;
}

.tree-node {
  display: flex;
  align-items: center;
  padding: 4px 12px;
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

.folder-node {
  padding-left: 8px;
}

.source-node {
  padding-left: 24px;
}

.subfolder-node {
  padding-left: 24px;
}

.subfolder-icon {
  opacity: 0.6;
}

.subfolder-source-node {
  padding-left: 40px;
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

.tree-label.error-label {
  color: #d03050;
  opacity: 0.8;
}

.error-icon {
  margin-right: 4px;
}

.tree-badge {
  font-size: 11px;
  background: rgba(255, 255, 255, 0.1);
  padding: 1px 6px;
  border-radius: 10px;
  color: rgba(255, 255, 255, 0.6);
}

.section-node {
  padding-left: 8px;
}

.section-label {
  font-weight: 500;
  color: rgba(255, 255, 255, 0.9);
}

.star-icon {
  color: #f5a623;
}

.recent-icon {
  color: #36cfc9;
}

.sort-toggle-btn {
  margin-left: auto;
  opacity: 0.6;
  transition: opacity 0.2s;
}

.sort-toggle-btn:hover {
  opacity: 1;
}

.section-divider {
  height: 1px;
  background: rgba(255, 255, 255, 0.1);
  margin: 8px 12px;
}

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

.group-actions,
.folder-actions,
.source-actions,
.subfolder-actions {
  opacity: 0;
  transition: opacity 0.2s;
  display: flex;
  gap: 0;
}

.tree-node:hover .group-actions,
.tree-node:hover .folder-actions,
.tree-node:hover .source-actions,
.tree-node:hover .subfolder-actions {
  opacity: 1;
}

/* Light theme */
:global(.n-config-provider--light) .tree-node:hover,
.sidebar-layout.light-theme .tree-node:hover {
  background-color: rgba(0, 0, 0, 0.05);
}

:global(.n-config-provider--light) .loading-text,
.sidebar-layout.light-theme .loading-text {
  color: rgba(0, 0, 0, 0.5);
}

:global(.n-config-provider--light) .empty-text,
.sidebar-layout.light-theme .empty-text {
  color: rgba(0, 0, 0, 0.5);
}

:global(.n-config-provider--light) .tree-badge,
.sidebar-layout.light-theme .tree-badge {
  background: rgba(0, 0, 0, 0.08);
  color: rgba(0, 0, 0, 0.6);
}

:global(.n-config-provider--light) .section-label,
.sidebar-layout.light-theme .section-label {
  color: rgba(0, 0, 0, 0.85);
}

:global(.n-config-provider--light) .section-divider,
.sidebar-layout.light-theme .section-divider {
  background: rgba(0, 0, 0, 0.08);
}
</style>
