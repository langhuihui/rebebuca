<template>
  <n-card title="剪辑区间" size="small">
    <template #header-extra>
      <n-space>
        <n-tag v-if="trimming.enabled" :bordered="false" type="success">
          已启用
        </n-tag>
        <n-switch v-model:value="trimming.enabled" size="small" @update:value="toggleEnabled" />
      </n-space>
    </template>

    <n-space vertical :size="16">
      <n-alert type="info">
        设置视频的开始和结束时间，只处理指定区间的视频
      </n-alert>

      <template v-if="trimming.enabled">
        <!-- 时间输入 -->
        <n-grid :cols="2" :x-gap="16">
          <n-gi>
            <n-form-item label="开始时间">
              <n-time-picker
                v-model:formatted-value="startTime"
                :is-hours-visible="true"
                :is-minutes-visible="true"
                :is-seconds-visible="true"
                :is-ms-visible="true"
                format="HH:mm:ss.SSS"
                value-format="HH:mm:ss.SSS"
                placeholder="00:00:00.000"
                style="width: 100%"
                @update:value="updateStartTime"
              />
            </n-form-item>
          </n-gi>
          <n-gi>
            <n-form-item label="结束时间">
              <n-time-picker
                v-model:formatted-value="endTime"
                :is-hours-visible="true"
                :is-minutes-visible="true"
                :is-seconds-visible="true"
                :is-ms-visible="true"
                format="HH:mm:ss.SSS"
                value-format="HH:mm:ss.SSS"
                placeholder="00:00:00.000"
                style="width: 100%"
                @update:value="updateEndTime"
              />
            </n-form-item>
          </n-gi>
        </n-grid>

        <!-- 时长显示 -->
        <n-card size="small" :bordered="true">
          <n-space vertical :size="8">
            <n-text strong>剪辑时长</n-text>
            <n-text style="font-size: 24px; font-weight: bold; color: #3b82f6">
              {{ duration }}
            </n-text>
            <n-text depth="3">
              {{ durationSeconds }} 秒 ({{ framesCount }} 帧 @ {{ assumedFps }} fps)
            </n-text>
          </n-space>
        </n-card>

        <!-- 快速设置 -->
        <n-divider>快速设置</n-divider>

        <n-grid :cols="2" :x-gap="12">
          <n-gi>
            <n-button block @click="setTrimFirstMinute">首分钟</n-button>
          </n-gi>
          <n-gi>
            <n-button block @click="setTrimFirst30Seconds">前30秒</n-button>
          </n-gi>
          <n-gi>
            <n-button block @click="setTrimFirst10Seconds">前10秒</n-button>
          </n-gi>
          <n-gi>
            <n-button block @click="setTrimFirst5Seconds">前5秒</n-button>
          </n-gi>
        </n-grid>

        <n-space style="width: 100%">
          <n-input-number
            v-model:value="customSeconds"
            :min="1"
            :max="3600"
            placeholder="秒数"
            style="flex: 1"
          />
          <n-button @click="setTrimCustomSeconds">开始</n-button>
        </n-space>

        <!-- 手动输入 -->
        <n-divider>手动输入</n-divider>

        <n-space vertical :size="8">
          <n-form-item label="开始时间 (HH:MM:SS.mmm)">
            <n-input
              v-model:value="trimming.startTime"
              placeholder="00:00:00.000"
              @blur="validateTime('start')"
            />
          </n-form-item>

          <n-form-item label="结束时间 (HH:MM:SS.mmm)">
            <n-input
              v-model:value="trimming.endTime"
              placeholder="00:00:00.000"
              @blur="validateTime('end')"
            />
          </n-form-item>
        </n-space>

        <!-- 错误提示 -->
        <n-alert
          v-if="timeError"
          type="error"
          :title="timeError"
        />

        <!-- 预览 -->
        <n-divider>时间轴预览</n-divider>

        <div class="timeline-preview">
          <div class="timeline-bar">
            <div
              class="timeline-selection"
              :style="selectionStyle"
            >
              <div class="timeline-label-left">{{ trimming.startTime }}</div>
              <div class="timeline-label-right">{{ trimming.endTime }}</div>
            </div>
          </div>
          <div class="timeline-ticks">
            <span>00:00:00</span>
            <span>00:00:30</span>
            <span>00:01:00</span>
            <span>00:01:30</span>
            <span>00:02:00</span>
          </div>
        </div>
      </template>
    </n-space>
  </n-card>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import {
  NCard,
  NSpace,
  NAlert,
  NSwitch,
  NGrid,
  NGi,
  NFormItem,
  NTimePicker,
  NText,
  NDivider,
  NButton,
  NInputNumber,
  NInput
} from 'naive-ui';
import type { Trimming } from '../types/preset';
import { useFFmpegParamsStore } from '../stores/ffmpegParams';

const ffmpegParams = useFFmpegParamsStore();

const trimming = computed(() => ffmpegParams.currentPreset.trimming);
const startTime = ref('00:00:00.000');
const endTime = ref('00:00:00.000');
const customSeconds = ref(30);
const timeError = ref('');
const assumedFps = 30; // 假设帧率

// 计算时长（秒）
const durationSeconds = computed(() => {
  const start = parseTimeToSeconds(trimming.value.startTime);
  const end = parseTimeToSeconds(trimming.value.endTime);
  return end - start;
});

// 格式化时长显示
const duration = computed(() => {
  const totalSeconds = durationSeconds.value;
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);
  const ms = Math.round((totalSeconds % 1) * 1000);

  const pad = (n: number, digits: number) => n.toString().padStart(digits, '0');

  if (hours > 0) {
    return `${pad(hours, 2)}:${pad(minutes, 2)}:${pad(seconds, 2)}.${pad(ms, 3)}`;
  }
  return `${pad(minutes, 2)}:${pad(seconds, 2)}.${pad(ms, 3)}`;
});

// 估算帧数
const framesCount = computed(() => {
  return Math.round(durationSeconds.value * assumedFps);
});

// 时间轴选择区域样式
const selectionStyle = computed(() => {
  const start = parseTimeToSeconds(trimming.value.startTime);
  const end = parseTimeToSeconds(trimming.value.endTime);
  const totalDuration = 120; // 假设总时长为 2 分钟

  const startPercent = (start / totalDuration) * 100;
  const endPercent = (end / totalDuration) * 100;
  const width = endPercent - startPercent;

  return {
    left: `${startPercent}%`,
    width: `${Math.min(width, 100)}%`
  };
});

// 解析时间为秒数
function parseTimeToSeconds(time: string): number {
  const match = time.match(/^(\d{2}):(\d{2}):(\d{2})(\.(\d{3}))?$/);
  if (!match) return 0;

  const hours = parseInt(match[1]);
  const minutes = parseInt(match[2]);
  const seconds = parseInt(match[3]);
  const ms = match[5] ? parseInt(match[5]) / 1000 : 0;

  return hours * 3600 + minutes * 60 + seconds + ms;
}

// 格式化秒数为时间字符串
function formatTimeFromSeconds(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.round((seconds % 1) * 1000);

  const pad = (n: number, digits: number) => n.toString().padStart(digits, '0');

  return `${pad(hours, 2)}:${pad(minutes, 2)}:${pad(secs, 2)}.${pad(ms, 3)}`;
}

// 切换启用状态
const toggleEnabled = (enabled: boolean) => {
  ffmpegParams.updateTrimmingConfig({
    enabled,
    startTime: enabled ? trimming.value.startTime : '00:00:00.000',
    endTime: enabled ? trimming.value.endTime : '00:00:00.000'
  });
};

// 更新时间
const updateStartTime = (value: string) => {
  if (value) {
    ffmpegParams.updateTrimmingConfig({
      enabled: true,
      startTime: value,
      endTime: trimming.value.endTime
    });
    validateTimeRange();
  }
};

const updateEndTime = (value: string) => {
  if (value) {
    ffmpegParams.updateTrimmingConfig({
      enabled: true,
      startTime: trimming.value.startTime,
      endTime: value
    });
    validateTimeRange();
  }
};

// 验证时间
const validateTime = (type: 'start' | 'end') => {
  const time = type === 'start' ? trimming.value.startTime : trimming.value.endTime;
  if (!/^\d{2}:\d{2}:\d{2}\.\d{3}$/.test(time)) {
    timeError.value = `时间格式错误，应为 HH:MM:SS.mmm`;
    return false;
  }

  validateTimeRange();
  return true;
};

// 验证时间范围
const validateTimeRange = () => {
  const start = parseTimeToSeconds(trimming.value.startTime);
  const end = parseTimeToSeconds(trimming.value.endTime);

  if (start >= end) {
    timeError.value = '开始时间必须早于结束时间';
  } else {
    timeError.value = '';
  }
};

// 快速设置
const setTrimFirstMinute = () => {
  ffmpegParams.updateTrimmingConfig({
    enabled: true,
    startTime: '00:00:00.000',
    endTime: '00:01:00.000'
  });
};

const setTrimFirst30Seconds = () => {
  ffmpegParams.updateTrimmingConfig({
    enabled: true,
    startTime: '00:00:00.000',
    endTime: '00:00:30.000'
  });
};

const setTrimFirst10Seconds = () => {
  ffmpegParams.updateTrimmingConfig({
    enabled: true,
    startTime: '00:00:00.000',
    endTime: '00:00:10.000'
  });
};

const setTrimFirst5Seconds = () => {
  ffmpegParams.updateTrimmingConfig({
    enabled: true,
    startTime: '00:00:00.000',
    endTime: '00:00:05.000'
  });
};

const setTrimCustomSeconds = () => {
  const seconds = customSeconds.value;
  if (seconds > 0) {
    ffmpegParams.updateTrimmingConfig({
      enabled: true,
      startTime: '00:00:00.000',
      endTime: formatTimeFromSeconds(seconds)
    });
  }
};

// 监听时间变化
watch(() => trimming.value, (val) => {
  startTime.value = val.startTime;
  endTime.value = val.endTime;
  validateTimeRange();
}, { deep: true });
</script>

<style scoped>
.timeline-preview {
  padding: 20px;
  background-color: var(--n-color-embedded);
  border-radius: 8px;
}

.timeline-bar {
  position: relative;
  height: 40px;
  background-color: #e5e7eb;
  border-radius: 4px;
  margin-bottom: 8px;
  overflow: hidden;
}

.timeline-selection {
  position: absolute;
  height: 100%;
  background-color: #3b82f6;
  top: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 8px;
  color: white;
  font-size: 11px;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
}

.timeline-label-left,
.timeline-label-right {
  flex-shrink: 0;
}

.timeline-ticks {
  display: flex;
  justify-content: space-between;
  color: #6b7280;
  font-size: 11px;
}
</style>
