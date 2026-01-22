<template>
  <div class="room-info-panel" :class="{ 'light-theme': effectiveTheme === 'light' }">
    <div class="panel-header">
      <div class="room-title">
        <n-icon size="24" :component="svgIcons.home" />
        <h2>{{ roomInfo.Name }}</h2>
        <n-tag size="small" type="primary" round>{{ roomInfo.RoomId }}</n-tag>
      </div>
      <div class="room-actions">
        <n-button size="small" type="primary" ghost @click="handleRefresh">
          <template #icon>
            <n-icon :component="iconComponents.replay" />
          </template>
          Refresh
        </n-button>
      </div>
    </div>

    <n-divider />

    <div class="panel-content">
      <n-grid :cols="2" :x-gap="24" :y-gap="24">
        <n-grid-item>
          <n-card title="General Information" size="small" hoverable>
            <n-descriptions label-placement="left" :column="1" size="small">
              <n-descriptions-item label="Owner">
                {{ roomInfo.Owner }}
              </n-descriptions-item>
              <n-descriptions-item label="Created Time">
                {{ roomInfo.CreateTime }}
              </n-descriptions-item>
              <n-descriptions-item label="Capacity">
                <n-space align="center" :size="4">
                  <n-progress
                    type="line"
                    :percentage="(roomInfo.OnlineCount / roomInfo.MaxCount) * 100"
                    :show-indicator="false"
                    style="width: 100px"
                  />
                  <span>{{ roomInfo.OnlineCount }} / {{ roomInfo.MaxCount }}</span>
                </n-space>
              </n-descriptions-item>
            </n-descriptions>
          </n-card>
        </n-grid-item>

        <n-grid-item>
          <n-card title="Status" size="small" hoverable>
            <div class="status-indicator">
              <div class="status-dot online"></div>
              <span class="status-text">Active</span>
            </div>
            <p class="status-desc">This room is currently active and accepting connections.</p>
          </n-card>
        </n-grid-item>
      </n-grid>

      <div class="raw-data-section">
        <n-collapse>
          <n-collapse-item title="Raw Data (Debug)" name="raw">
            <pre class="raw-json">{{ JSON.stringify(roomInfo, null, 2) }}</pre>
          </n-collapse-item>
        </n-collapse>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { defineProps } from 'vue';
import { 
  NDivider, NGrid, NGridItem, NCard, NDescriptions, 
  NDescriptionsItem, NTag, NIcon, NButton, NSpace,
  NProgress, NCollapse, NCollapseItem
} from 'naive-ui';
import { useTheme } from '../composables/useTheme';
import { svgIcons, iconComponents } from '../utils/icons';

const props = defineProps<{
  roomInfo: {
    RoomId: string;
    Name: string;
    Owner: string;
    OnlineCount: number;
    MaxCount: number;
    CreateTime: string;
  }
}>();

const { effectiveTheme } = useTheme();

const handleRefresh = () => {
  // Logic to refresh room info can be added here
  console.log('Refreshing room info for:', props.roomInfo.RoomId);
};
</script>

<style scoped>
.room-info-panel {
  padding: 24px;
  height: 100%;
  overflow-y: auto;
  background: #1e1e1e;
  color: #d4d4d4;
}

.room-info-panel.light-theme {
  background: #ffffff;
  color: #333333;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.room-title {
  display: flex;
  align-items: center;
  gap: 12px;
}

.room-title h2 {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
}

.panel-content {
  margin-top: 24px;
}

.status-indicator {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.status-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}

.status-dot.online {
  background: #18a058;
  box-shadow: 0 0 8px rgba(24, 160, 88, 0.5);
}

.status-text {
  font-weight: 500;
}

.status-desc {
  font-size: 13px;
  opacity: 0.8;
  margin: 0;
}

.raw-data-section {
  margin-top: 32px;
}

.raw-json {
  background: rgba(0, 0, 0, 0.3);
  padding: 12px;
  border-radius: 4px;
  font-family: monospace;
  font-size: 12px;
  overflow-x: auto;
}

.light-theme .raw-json {
  background: #f5f5f5;
}
</style>
