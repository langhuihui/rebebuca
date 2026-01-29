<template>
  <div class="example-library">
    <!-- 头部 -->
    <div class="library-header">
      <div class="header-title">
        <span class="title-icon">📚</span>
        <h3>示例�?/h3>
      </div>
      <n-input
        v-model:value="searchQuery"
        placeholder="搜索示例..."
        size="small"
        clearable
        class="search-input"
      >
        <template #prefix>
          <span>🔍</span>
        </template>
      </n-input>
    </div>

    <!-- 分类标签 -->
    <div class="category-tabs">
      <n-button
        text
        :type="selectedCategory === 'all' ? 'primary' : 'default'"
        size="small"
        @click="selectCategory('all')"
      >
        全部
      </n-button>
      <n-button
        v-for="category in categories"
        :key="category"
        text
        :type="selectedCategory === category ? 'primary' : 'default'"
        size="small"
        @click="selectCategory(category)"
      >
        {{ categoryLabels[category] || category }}
      </n-button>
    </div>

    <!-- 示例列表 -->
    <n-scrollbar class="example-list">
      <div v-if="filteredExamples.length === 0" class="empty-state">
        <n-empty description="没有找到示例" size="small" />
      </div>

      <div v-else class="example-items">
        <div
          v-for="example in filteredExamples"
          :key="example.id"
          class="example-item"
          @click="selectExample(example)"
        >
          <div class="example-header">
            <span class="example-icon">{{ example.icon }}</span>
            <div class="example-title-group">
              <span class="example-name">{{ example.name }}</span>
              <n-tag
                :bordered="false"
                size="tiny"
                type="info"
                class="example-tag"
              >
                {{ categoryLabels[example.category] || example.category }}
              </n-tag>
            </div>
          </div>
          <div class="example-description">
            {{ example.description }}
          </div>
          <div class="example-preview">
            <code class="filter-code">{{ example.filterComplex }}</code>
          </div>
        </div>
      </div>
    </n-scrollbar>

    <!-- 示例详情对话�?-->
    <n-modal
      v-model:show="showPreview"
      preset="card"
      title="示例预览"
      style="width: 700px"
    >
      <div v-if="selectedExample" class="example-detail">
        <div class="detail-header">
          <span class="detail-icon">{{ selectedExample.icon }}</span>
          <div class="detail-title-group">
            <h3>{{ selectedExample.name }}</h3>
            <n-tag
              :bordered="false"
              type="info"
            >
              {{ categoryLabels[selectedExample.category] || selectedExample.category }}
            </n-tag>
          </div>
        </div>
        <p class="detail-description">{{ selectedExample.description }}</p>

        <div class="detail-section">
          <h4>滤镜�?/h4>
          <n-code
            :code="selectedExample.filterComplex"
            language="bash"
            :word-wrap="true"
          />
        </div>

        <div class="detail-section">
          <h4>节点图预�?/h4>
          <div class="graph-preview">
            <div
              v-for="node in selectedExample.nodes"
              :key="node.id"
              class="preview-node"
              :class="`node-${node.type}`"
            >
              <span v-if="node.type === 'input'" class="node-type-icon">⬇️</span>
              <span v-else-if="node.type === 'filter'" class="node-type-icon">⚙️</span>
              <span v-else class="node-type-icon">⬆️</span>
              <span class="node-label">{{ node.data.label || node.data.name }}</span>
            </div>
            <div class="preview-arrow">�?/div>
          </div>
        </div>

        <template #footer>
          <n-space justify="end">
            <n-button @click="showPreview = false">取消</n-button>
            <n-button type="primary" @click="loadExample">
              <template #icon>
                <span>📥</span>
              </template>
              加载示例
            </n-button>
          </n-space>
        </template>
      </div>
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import {
  NInput,
  NButton,
  NTag,
  NScrollbar,
  NEmpty,
  NModal,
  NCode,
  NSpace,
  useDialog
} from 'naive-ui';
import type { FilterGraphData } from '@/ffmpeg/types/preset';

// 示例数据类型
interface ExampleData {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  filterComplex: string;
  nodes: any[];
  edges: any[];
}

// Props
interface Props {
  examples: ExampleData[];
}

const props = defineProps<Props>();

// Emits
const emit = defineEmits<{
  (e: 'load-example', exampleData: FilterGraphData): void;
}>();

// 对话�?
const dialog = useDialog();

// 响应式数�?
const searchQuery = ref('');
const selectedCategory = ref<string>('all');
const showPreview = ref(false);
const selectedExample = ref<ExampleData | null>(null);

// 分类标签
const categoryLabels: Record<string, string> = {
  basic: '基础',
  transform: '变换',
  color: '色彩',
  audio: '音频',
  subtitle: '字幕',
  overlay: '叠加',
  advanced: '高级'
};

// 计算属�?
const categories = computed(() => {
  const uniqueCategories = new Set(props.examples.map(ex => ex.category));
  return Array.from(uniqueCategories);
});

const filteredExamples = computed(() => {
  let examples = props.examples;

  // 分类筛�?
  if (selectedCategory.value !== 'all') {
    examples = examples.filter(ex => ex.category === selectedCategory.value);
  }

  // 搜索筛�?
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase();
    examples = examples.filter(ex =>
      ex.name.toLowerCase().includes(query) ||
      ex.description.toLowerCase().includes(query)
    );
  }

  return examples;
});

// 方法
const selectCategory = (category: string) => {
  selectedCategory.value = category;
};

const selectExample = (example: ExampleData) => {
  selectedExample.value = example;
  showPreview.value = true;
};

const loadExample = () => {
  if (!selectedExample.value) return;

  // 确认加载
  dialog.warning({
    title: '确认加载示例',
    content: '加载示例将覆盖当前节点图，是否继续？',
    positiveText: '确定加载',
    negativeText: '取消',
    onPositiveClick: () => {
      const exampleData: FilterGraphData = {
        nodes: selectedExample.value!.nodes,
        edges: selectedExample.value!.edges
      };
      emit('load-example', exampleData);
      showPreview.value = false;
    }
  });
};

// 生命周期
onMounted(() => {
  // 初始化时默认选中第一个分�?
  if (categories.value.length > 0) {
    selectedCategory.value = 'all';
  }
});
</script>

<style scoped>
.example-library {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--n-color);
}

.library-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px;
  border-bottom: 1px solid var(--n-border-color);
}

.header-title {
  display: flex;
  align-items: center;
  gap: 8px;
}

.title-icon {
  font-size: 20px;
}

.header-title h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}

.search-input {
  width: 160px;
}

.category-tabs {
  display: flex;
  gap: 4px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--n-border-color);
  overflow-x: auto;
}

.example-list {
  flex: 1;
  padding: 8px;
}

.empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
}

.example-items {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.example-item {
  background: var(--n-color-embedded);
  border: 1px solid var(--n-border-color);
  border-radius: 8px;
  padding: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.example-item:hover {
  border-color: var(--n-primary-color);
  background: var(--n-primary-color-hover);
  transform: translateX(4px);
}

.example-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 6px;
}

.example-icon {
  font-size: 24px;
}

.example-title-group {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
}

.example-name {
  font-weight: 500;
  font-size: 14px;
}

.example-tag {
  flex-shrink: 0;
}

.example-description {
  font-size: 12px;
  color: var(--n-text-color-2);
  margin-bottom: 8px;
  line-height: 1.5;
}

.example-preview {
  background: var(--n-color-modal);
  border-radius: 4px;
  padding: 6px 10px;
  overflow: hidden;
}

.filter-code {
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 11px;
  color: var(--n-text-color-2);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  display: block;
}

/* 示例详情 */
.example-detail {
  padding: 8px 0;
}

.detail-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.detail-icon {
  font-size: 40px;
}

.detail-title-group {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 12px;
}

.detail-title-group h3 {
  margin: 0;
  font-size: 20px;
}

.detail-description {
  font-size: 14px;
  color: var(--n-text-color-2);
  line-height: 1.6;
  margin: 0 0 16px 0;
}

.detail-section {
  margin-bottom: 20px;
}

.detail-section h4 {
  margin: 0 0 8px 0;
  font-size: 14px;
  font-weight: 600;
}

.graph-preview {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 20px;
  background: var(--n-color-embedded);
  border-radius: 8px;
  flex-wrap: wrap;
}

.preview-node {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
}

.preview-node.node-input {
  background: #e3f2fd;
  color: #1976d2;
}

.preview-node.node-filter {
  background: #e8f5e9;
  color: #388e3c;
}

.preview-node.node-output {
  background: #fff3e0;
  color: #f57c00;
}

.node-type-icon {
  font-size: 16px;
}

.preview-arrow {
  color: var(--n-text-color-3);
  font-size: 20px;
}
</style>
