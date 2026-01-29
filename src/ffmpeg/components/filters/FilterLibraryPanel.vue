<template>
  <div class="filter-library-panel">
    <!-- 搜索框 -->
    <div class="search-container">
      <n-auto-complete
        v-model:value="searchQuery"
        :options="searchSuggestions"
        placeholder="搜索滤镜..."
        clearable
        size="small"
        @update:value="onSearch"
        @select="onSelectSuggestion"
        @focus="showSuggestions = true"
        @blur="onBlur"
      >
        <template #prefix>
          <n-icon size="14">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="11" cy="11" r="8"/>
              <line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
          </n-icon>
        </template>
      </n-auto-complete>
    </div>

    <!-- 搜索历史和热门滤镜（无搜索时显示） -->
    <div v-if="!searchQuery" class="quick-access">
      <!-- 搜索历史 -->
      <div v-if="searchHistory.length > 0" class="search-history">
        <div class="quick-access-header">
          <span class="quick-access-title">
            <n-icon size="12" style="margin-right: 4px;">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <polyline points="12 6 12 12 16 14"/>
              </svg>
            </n-icon>
            搜索历史
          </span>
          <n-button
            text
            size="tiny"
            @click="clearSearchHistory"
          >
            清除
          </n-button>
        </div>
        <n-scrollbar style="max-height: 100px" x-scrollable>
          <n-space :size="4">
            <n-tag
              v-for="item in searchHistory.slice(0, 10)"
              :key="item.query"
              :bordered="false"
              size="small"
              @click="onSelectHistory(item.query)"
            >
              {{ item.query }}
            </n-tag>
          </n-space>
        </n-scrollbar>
      </div>

      <!-- 热门滤镜 -->
      <div class="popular-filters">
        <div class="quick-access-header">
          <span class="quick-access-title">
            <n-icon size="12" style="margin-right: 4px;">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>
              </svg>
            </n-icon>
            热门滤镜
          </span>
        </div>
        <div class="popular-filters-list">
          <div
            v-for="item in popularFilters.slice(0, 5)"
            :key="item.filter.id"
            class="popular-filter-item"
            draggable="true"
            @dragstart="onDragStart($event, item.filter)"
            @click="onAddFilter(item.filter)"
          >
            <span class="popular-filter-icon">{{ item.filter.icon }}</span>
            <span class="popular-filter-name">{{ item.filter.name }}</span>
            <span class="popular-filter-count">{{ item.popularity }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 分类标签 -->
    <n-scrollbar style="max-height: 40px" x-scrollable>
      <n-space :size="4">
        <n-tag
          :bordered="false"
          :type="selectedCategory === 'all' ? 'primary' : 'default'"
          size="small"
          round
          @click="onSelectCategory('all')"
        >
          全部
        </n-tag>
        <n-tag
          v-for="category in categories"
          :key="category"
          :bordered="false"
          :type="selectedCategory === category ? 'primary' : 'default'"
          size="small"
          round
          @click="onSelectCategory(category)"
        >
          {{ categoryLabels[category] }}
        </n-tag>
      </n-space>
    </n-scrollbar>

    <!-- 筛选选项 -->
    <n-space v-if="showAdvancedFilters" :size="8" style="margin-bottom: 8px">
      <n-select
        v-model:value="filterTypeFilter"
        :options="filterTypeOptions"
        placeholder="滤镜类型"
        size="tiny"
        clearable
        style="width: 100px"
        @update:value="onFilterTypeChange"
      />
      <n-select
        v-model:value="sortBy"
        :options="sortOptions"
        placeholder="排序方式"
        size="tiny"
        style="width: 100px"
        @update:value="onSortByChange"
      />
      <n-button
        text
        size="tiny"
        @click="toggleMultiCategory"
      >
        {{ isMultiCategory ? '✓ 多选' : '多选' }}
      </n-button>
    </n-space>

    <!-- 搜索性能指示器 -->
    <div v-if="searchExecutionTime > 0" class="search-perf">
      <n-text depth="3" style="font-size: 10px">
        搜索耗时: {{ searchExecutionTime.toFixed(2) }}ms
      </n-text>
    </div>

    <!-- 滤镜列表 -->
    <n-scrollbar style="flex: 1">
      <div v-if="loading" class="loading-state">
        <n-spin size="small" />
      </div>

      <div v-else-if="error" class="error-state">
        <n-alert type="error" :bordered="false" size="small">
          {{ error }}
        </n-alert>
      </div>

      <div v-else-if="filteredFilters.length === 0" class="empty-state">
        <n-empty description="没有找到滤镜" size="small">
          <template #extra>
            <n-button size="small" @click="onClearFilters">
              清除筛选条件
            </n-button>
          </template>
        </n-empty>
      </div>

      <div v-else class="filter-list">
        <div
          v-for="filter in filteredFilters"
          :key="filter.id"
          class="filter-item"
          draggable="true"
          @dragstart="onDragStart($event, filter)"
          @click="onAddFilter(filter)"
        >
          <n-space align="center" :size="8">
            <span class="filter-icon">{{ filter.icon }}</span>
            <div class="filter-info">
              <span
                class="filter-name"
                v-html="filter.highlightText || filter.name"
              ></span>
            </div>
          </n-space>
          <n-text depth="3" style="font-size: 11px; line-height: 1.3; margin-top: 4px;">
            {{ filter.description }}
          </n-text>
        </div>
      </div>
    </n-scrollbar>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import {
  NAutoComplete,
  NSpace,
  NTag,
  NScrollbar,
  NSpin,
  NAlert,
  NEmpty,
  NText,
  NButton,
  NSelect,
  NIcon
} from 'naive-ui';
import type { FilterDefinition, FilterCategory } from '@/ffmpeg/types/preset';
import {
  filterSearchService,
  type SearchResultWithHighlight,
  type SearchHistoryItem,
  type PopularFilter
} from '@/ffmpeg/services/filterSearchService';

interface Props {
  filters: FilterDefinition[];
  loading?: boolean;
  error?: string | null;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  (e: 'add-filter', filter: FilterDefinition): void;
  (e: 'search', query: string): void;
  (e: 'filter-by-category', category: FilterCategory | 'all'): void;
}>();

const searchQuery = ref('');
const selectedCategory = ref<FilterCategory | 'all'>('all');
const showAdvancedFilters = ref(false);
const showSuggestions = ref(false);
const searchExecutionTime = ref(0);
const filterTypeFilter = ref<string | null>(null);
const sortBy = ref<'name' | 'popularity'>('name');
const isMultiCategory = ref(false);
const selectedCategories = ref<Set<FilterCategory>>(new Set());

const searchResults = ref<SearchResultWithHighlight[]>([]);
const searchHistory = ref<SearchHistoryItem[]>([]);
const popularFilters = ref<PopularFilter[]>([]);

const categoryLabels: Record<FilterCategory, string> = {
  basic: '基础',
  transform: '变换',
  color: '色彩',
  audio: '音频',
  subtitle: '字幕',
  overlay: '叠加',
  advanced: '高级'
};

const filterTypeOptions = [
  { label: 'V->V', value: 'video' },
  { label: 'A->A', value: 'audio' },
  { label: '生成器', value: 'generator' },
  { label: '分流器', value: 'splitter' },
  { label: '合流器', value: 'merger' },
  { label: '复杂', value: 'complex' }
];

const sortOptions = [
  { label: '名称', value: 'name' },
  { label: '热度', value: 'popularity' }
];

const categories = computed(() => {
  return Array.from(new Set(props.filters.map(f => f.category)));
});

const searchSuggestions = computed(() => {
  if (!searchQuery.value) {
    return [];
  }

  const suggestions = filterSearchService.getSuggestions(searchQuery.value, 5);
  return suggestions.map(s => ({ label: s, value: s }));
});

const filteredFilters = computed(() => {
  let filters: SearchResultWithHighlight[] = [];

  // 如果有搜索查询，使用搜索结果
  if (searchQuery.value) {
    filters = searchResults.value;
  } else {
    // 否则使用分类筛选
    if (isMultiCategory.value && selectedCategories.value.size > 0) {
      filters = props.filters.filter(f =>
        selectedCategories.value.has(f.category)
      ) as SearchResultWithHighlight[];
    } else if (selectedCategory.value !== 'all') {
      filters = props.filters.filter(
        f => f.category === selectedCategory.value
      ) as SearchResultWithHighlight[];
    } else {
      filters = props.filters as SearchResultWithHighlight[];
    }

    // 按类型筛选
    if (filterTypeFilter.value) {
      filters = filters.filter(f => f.filterType === filterTypeFilter.value);
    }

    // 排序
    if (sortBy.value === 'popularity') {
      const popularityMap = new Map(
        popularFilters.value.map(p => [p.filter.id, p.popularity])
      );
      filters = filters.sort((a, b) => {
        const aPop = popularityMap.get(a.id) || 0;
        const bPop = popularityMap.get(b.id) || 0;
        return bPop - aPop;
      });
    } else {
      filters = filters.sort((a, b) => a.name.localeCompare(b.name));
    }
  }

  return filters;
});

// 节流搜索
let searchTimeout: number | null = null;

const onSearch = (query: string) => {
  searchQuery.value = query;

  if (!query.trim()) {
    searchResults.value = [];
    searchExecutionTime.value = 0;
    emit('search', '');
    return;
  }

  // 节流搜索（150ms）
  if (searchTimeout !== null) {
    clearTimeout(searchTimeout);
  }

  searchTimeout = setTimeout(() => {
    const startTime = performance.now();
    const results = filterSearchService.search(query, {
      fuzzy: true,
      maxResults: 50,
      includeDescription: true
    });
    const executionTime = performance.now() - startTime;

    searchResults.value = results.results;
    searchExecutionTime.value = executionTime;
    emit('search', query);

    // 更新搜索历史
    searchHistory.value = filterSearchService.getSearchHistory();
  }, 150);
};

const onSelectSuggestion = (value: string) => {
  searchQuery.value = value;
  onSearch(value);
  showSuggestions.value = false;
};

const onSelectHistory = (query: string) => {
  searchQuery.value = query;
  onSearch(query);
};

const clearSearchHistory = () => {
  filterSearchService.clearSearchHistory();
  searchHistory.value = [];
};

const onSelectCategory = (category: FilterCategory | 'all') => {
  if (isMultiCategory.value && category !== 'all') {
    // 多选模式
    if (selectedCategories.value.has(category)) {
      selectedCategories.value.delete(category);
    } else {
      selectedCategories.value.add(category);
    }
  } else {
    // 单选模式
    selectedCategory.value = category;
    emit('filter-by-category', category);
  }
};

const toggleMultiCategory = () => {
  isMultiCategory.value = !isMultiCategory.value;

  if (isMultiCategory.value) {
    selectedCategories.value.clear();
  }
};

const onFilterTypeChange = (value: string | null) => {
  filterTypeFilter.value = value;
};

const onSortByChange = (value: 'name' | 'popularity') => {
  sortBy.value = value;
};

const onClearFilters = () => {
  searchQuery.value = '';
  selectedCategory.value = 'all';
  filterTypeFilter.value = null;
  sortBy.value = 'name';
  isMultiCategory.value = false;
  selectedCategories.value.clear();
  searchResults.value = [];
  emit('search', '');
};

const onAddFilter = (filter: FilterDefinition) => {
  emit('add-filter', filter);

  // 记录使用频率
  filterSearchService.recordFilterUsage(filter.id);
  popularFilters.value = filterSearchService.getPopularFilters(10);
};

const onDragStart = (event: DragEvent, filter: FilterDefinition) => {
  if (event.dataTransfer) {
    event.dataTransfer.setData('application/json', JSON.stringify(filter));
    event.dataTransfer.effectAllowed = 'copy';
  }

  // 记录使用频率
  filterSearchService.recordFilterUsage(filter.id);
  popularFilters.value = filterSearchService.getPopularFilters(10);
};

const onBlur = () => {
  setTimeout(() => {
    showSuggestions.value = false;
  }, 200);
};

// 初始化
onMounted(() => {
  // 设置搜索服务的滤镜数据
  filterSearchService.setFilters(props.filters);

  // 加载搜索历史和热门滤镜
  searchHistory.value = filterSearchService.getSearchHistory();
  popularFilters.value = filterSearchService.getPopularFilters(10);
});

// 监听滤镜列表变化
watch(() => props.filters, (newFilters) => {
  filterSearchService.setFilters(newFilters);
}, { deep: true });
</script>

<style scoped>
.filter-library-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 12px;
  gap: 12px;
  background: var(--n-color);
}

.search-container {
  position: relative;
}

.quick-access {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 8px;
  background: var(--n-color-embedded);
  border-radius: 6px;
}

.quick-access-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
}

.quick-access-title {
  font-size: 12px;
  font-weight: 500;
  color: var(--n-text-color-2);
}

.search-history {
  border-bottom: 1px solid var(--n-divider-color);
  padding-bottom: 8px;
}

.popular-filters {
  padding-top: 4px;
}

.popular-filters-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.popular-filter-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  background: var(--n-color-modal);
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
}

.popular-filter-item:hover {
  background: var(--n-primary-color-hover);
  transform: translateX(2px);
}

.popular-filter-icon {
  font-size: 14px;
}

.popular-filter-name {
  flex: 1;
  font-size: 12px;
  font-weight: 500;
}

.popular-filter-count {
  font-size: 10px;
  color: var(--n-text-color-3);
  background: var(--n-color-embedded);
  padding: 2px 6px;
  border-radius: 10px;
}

.search-perf {
  display: flex;
  justify-content: flex-end;
  padding: 4px 0;
}

.loading-state,
.error-state,
.empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  min-height: 100px;
}

.filter-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.filter-item {
  background: var(--n-color-embedded);
  border: 1px solid var(--n-border-color);
  border-radius: 6px;
  padding: 10px;
  cursor: pointer;
  transition: all 0.2s;
  user-select: none;
}

.filter-item:hover {
  border-color: var(--n-primary-color);
  background: var(--n-primary-color-hover);
  transform: translateX(2px);
}

.filter-item:active {
  transform: translateX(1px);
}

.filter-icon {
  font-size: 16px;
}

.filter-info {
  flex: 1;
  overflow: hidden;
}

.filter-name {
  font-weight: 500;
  font-size: 13px;
  word-break: break-word;
}

/* 搜索高亮样式 */
.filter-name :deep(mark) {
  background: var(--n-warning-color);
  color: var(--n-text-color-1);
  padding: 0 2px;
  border-radius: 2px;
  font-weight: 600;
}
</style>
