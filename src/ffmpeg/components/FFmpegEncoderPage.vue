<template>
  <div class="ffmpeg-encoder-page">
    <n-page-header
      title="FFmpeg 视频编码器"
      subtitle="快速生成 FFmpeg 命令行并进行视频转码"
    >
      <template #extra>
        <n-space>
          <n-button @click="handleLoadExample">加载示例</n-button>
          <n-button @click="handleSaveToTaskList" :disabled="!canSaveTask">
            保存到任务列表
          </n-button>
          <n-button type="primary" @click="handleStartEncoding" :disabled="!canStartEncoding">
            开始转码
          </n-button>
        </n-space>
      </template>
    </n-page-header>

    <n-card :bordered="false" style="margin-top: 24px">
      <FFmpegConfigPanel />
    </n-card>

    <!-- 任务编辑对话框 -->
    <TaskEditDialog
      v-model:show="showTaskDialog"
      :is-edit-mode="dialogIsEditMode"
      :is-user-task="dialogIsUserTask"
      :task="editingTask"
      :group-id="dialogGroupId"
      :group-options="groupOptions"
      @update:task="editingTask = $event"
      @update:group-id="dialogGroupId = $event"
      @save="handleSaveTask"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import {
  NPageHeader,
  NCard,
  NSpace,
  NButton,
  useMessage
} from 'naive-ui';
import { FFmpegConfigPanel } from './index';
import { useFFmpegParamsStore } from '../stores/ffmpegParams';
import { useTaskManagerStore } from '../../stores/taskManager';
import TaskEditDialog from '../../components/sidebar/dialogs/TaskEditDialog.vue';
import type { TaskGroup } from '../../providers/types';
import { TaskType } from '../../providers/types';
import '../theme.css';

const message = useMessage();
const store = useFFmpegParamsStore();
const taskManager = useTaskManagerStore();

const canStartEncoding = computed(() => store.canStartEncoding);
const canSaveTask = computed(() => {
  // 需要有输入文件才能保存
  return store.inputFiles.length > 0;
});

// 任务编辑对话框状态
const showTaskDialog = ref(false);
const editingTask = ref<any>({
  id: '',
  name: '',
  command: '',
  cwd: '',
  envStr: '',
  type: TaskType.SHELL,
  sourceFile: '',
  useSystemTerminal: false,
  systemTerminalId: null,
  shellPath: null,
  pythonEnv: '',
  runAsAdmin: false,
  useSsh: false,
  sshConfigId: null,
});

const dialogGroupId = ref('');
const dialogIsEditMode = ref(false);
const dialogIsUserTask = ref(true);

// 任务组选项
const groupOptions = computed(() => {
  return taskManager.userGroups.map(group => ({
    label: group.name,
    value: group.id
  }));
});

// 初始化
onMounted(async () => {
  await store.initialize();
});

// 加载示例
const handleLoadExample = async () => {
  // 模拟添加一个示例文件
  store.addInputFile({
    name: 'example_video.mp4',
    path: '/path/to/example_video.mp4',
    size: 1024 * 1024 * 500, // 500MB
    type: 'video'
  });

  message.success('已加载示例文件');
};

// 保存到任务列表
const handleSaveToTaskList = () => {
  const command = store.commandPreview;

  // 如果没有命令,提示用户
  if (!command || command.trim() === '') {
    message.warning('请先配置 FFmpeg 参数');
    return;
  }

  // 初始化任务数据
  editingTask.value = {
    id: '',
    name: `FFmpeg 转码 - ${store.inputFiles[0]?.name || '未命名'}`,
    command: command,
    cwd: '',
    envStr: '',
    type: TaskType.SHELL,
    sourceFile: '',
    useSystemTerminal: false,
    systemTerminalId: null,
    shellPath: null,
    pythonEnv: '',
    runAsAdmin: false,
    useSsh: false,
    sshConfigId: null,
  };

  // 设置默认任务组
  const firstGroupId = taskManager.userGroups[0]?.id || '';
  dialogGroupId.value = firstGroupId;

  // 显示任务编辑对话框
  dialogIsEditMode.value = false;
  dialogIsUserTask.value = true;
  showTaskDialog.value = true;
};

// 处理保存任务
const handleSaveTask = async (task: any, groupId: string, newGroupName: string) => {
  try {
    // 处理新建任务组的情况
    let finalGroupId = groupId;
    if (groupId === '__new__' && newGroupName) {
      finalGroupId = await taskManager.createGroup(newGroupName);
    }

    // 查找任务组
    const selectedGroup = taskManager.userGroups.find(g => g.id === finalGroupId);
    if (!selectedGroup) {
      message.error('未找到选择的任务组');
      return;
    }

    // 构建任务数据
    const taskData: any = {
      name: task.name,
      command: task.command,
      type: task.type || TaskType.SHELL,
      description: `输入: ${store.inputFiles.map(f => f.name).join(', ')}`,
      cwd: task.cwd || '',
      useSystemTerminal: task.useSystemTerminal || false,
      shellPath: task.shellPath || undefined,
      envStr: task.envStr || '',
      pythonEnv: task.pythonEnv || '',
      runAsAdmin: task.runAsAdmin || false,
      useSsh: task.useSsh || false,
      sshConfigId: task.sshConfigId || undefined,
    };

    // 添加任务到选中的组
    await taskManager.addTaskToGroup(finalGroupId, taskData);

    message.success(`任务 "${task.name}" 已保存到任务列表`);
    showTaskDialog.value = false;
  } catch (error) {
    console.error('Failed to save task:', error);
    message.error('保存任务失败');
  }
};

// 开始转码
const handleStartEncoding = async () => {
  try {
    const command = store.commandPreview;
    message.info(`命令: ${command}`);

    // 这里可以集成到实际的转码流程
    // 例如调用 Tauri 的 shell 命令或通过 API 执行

    message.success('转码任务已创建（演示）');
  } catch (error) {
    console.error('Failed to start encoding:', error);
    message.error('转码失败');
  }
};
</script>

<style scoped>
.ffmpeg-encoder-page {
  padding: 24px;
  max-width: 1200px;
  margin: 0 auto;
}
</style>
