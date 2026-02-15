/**
 * FFmpeg 预设管理 Store
 * 负责预设的增删改查、导入导出和持久化
 */

import { defineStore } from 'pinia';
import type { FFmpegPreset, PresetMetadata, PackedPreset } from '../types/preset';
import { presetConverter } from '../services/presetConverter';
import presetsData from '../data/presets.json';

export type { PackedPreset };

/**
 * 预设分类类型
 */
export type PresetCategory = 'all' | 'builtin' | 'custom' | 'imported';

/**
 * 预设导入导出格式
 */
export type ExportFormat = 'json' | '3fui';

/**
 * 预设过滤条件
 */
export interface PresetFilter {
  category: PresetCategory;
  searchQuery: string;
  tags: string[];
}

export const usePresetsStore = defineStore('presets', {
  state: () => ({
    // 内置预设
    builtinPresets: [] as PackedPreset[],

    // 自定义预设
    customPresets: [] as PackedPreset[],

    // 导入的预设（从3FUI导入）
    importedPresets: [] as PackedPreset[],

    // 当前选中的预设 ID
    selectedPresetId: '',

    // 加载状态
    loading: false,

    // 错误信息
    error: null as string | null,

    // 当前过滤条件
    filter: {
      category: 'all' as PresetCategory,
      searchQuery: '',
      tags: []
    } as PresetFilter
  }),

  getters: {
    /**
     * 获取所有预设
     */
    allPresets(state): PackedPreset[] {
      return [...state.builtinPresets, ...state.customPresets, ...state.importedPresets];
    },

    /**
     * 根据过滤条件获取预设列表
     */
    filteredPresets(state): PackedPreset[] {
      let presets: PackedPreset[] = [];

      // 按分类过滤
      switch (state.filter.category) {
        case 'builtin':
          presets = [...state.builtinPresets];
          break;
        case 'custom':
          presets = [...state.customPresets];
          break;
        case 'imported':
          presets = [...state.importedPresets];
          break;
        case 'all':
        default:
          presets = [...state.builtinPresets, ...state.customPresets, ...state.importedPresets];
          break;
      }

      // 按搜索关键词过滤
      if (state.filter.searchQuery.trim()) {
        const query = state.filter.searchQuery.toLowerCase();
        presets = presets.filter(p =>
          p.name.toLowerCase().includes(query) ||
          (p.description && p.description.toLowerCase().includes(query))
        );
      }

      // 按标签过滤
      if (state.filter.tags.length > 0) {
        presets = presets.filter(p =>
          p.tags && p.tags.some(tag => state.filter.tags.includes(tag))
        );
      }

      return presets;
    },

    /**
     * 获取当前选中的预设
     */
    selectedPreset(state): PackedPreset | undefined {
      return [...state.builtinPresets, ...state.customPresets, ...state.importedPresets].find((p: PackedPreset) => p.id === state.selectedPresetId);
    },

    /**
     * 获取所有可用的标签
     */
    availableTags(state): string[] {
      const tagSet = new Set<string>();
      const all = [...state.builtinPresets, ...state.customPresets, ...state.importedPresets];
      all.forEach((preset: PackedPreset) => {
        if (preset.tags) {
          preset.tags.forEach((tag: string) => tagSet.add(tag));
        }
      });
      return Array.from(tagSet).sort();
    },

    /**
     * 统计各分类的预设数量
     */
    presetCounts(state) {
      return {
        builtin: state.builtinPresets.length,
        custom: state.customPresets.length,
        imported: state.importedPresets.length,
        total: state.builtinPresets.length + state.customPresets.length + state.importedPresets.length
      };
    }
  },

  actions: {
    /**
     * 初始化 store
     */
    async initialize() {
      this.loading = true;
      this.error = null;

      try {
        // 加载内置预设（断言为 PackedPreset，JSON 中 quality.controlMode 为 string）
        this.builtinPresets = presetsData.builtin.map(p => ({
          ...p,
          version: '1.0.0',
          createdAt: Date.now(),
          updatedAt: Date.now()
        })) as PackedPreset[];

        // 从本地存储加载自定义预设
        await this.loadCustomPresets();

        // 从本地存储加载导入的预设
        await this.loadImportedPresets();

        // 默认选中第一个内置预设
        if (this.builtinPresets.length > 0) {
          this.selectedPresetId = this.builtinPresets[0].id;
        }
      } catch (error) {
        console.error('Failed to initialize presets store:', error);
        this.error = 'Failed to initialize presets';
        throw error;
      } finally {
        this.loading = false;
      }
    },

    /**
     * 保存自定义预设
     */
    async saveCustomPreset(
      name: string,
      preset: FFmpegPreset,
      description?: string,
      tags: string[] = []
    ): Promise<string> {
      const metadata: PresetMetadata = {
        id: `custom-${Date.now()}`,
        name,
        description: description || '',
        version: '1.0.0',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        tags
      };

      const customPreset: PackedPreset = {
        ...metadata,
        preset: JSON.parse(JSON.stringify(preset))
      };

      this.customPresets.push(customPreset);
      await this.saveCustomPresetsToStorage();

      return metadata.id;
    },

    /**
     * 更新自定义预设
     */
    async updateCustomPreset(
      id: string,
      updates: Partial<PresetMetadata & { preset: FFmpegPreset }>
    ): Promise<boolean> {
      const index = this.customPresets.findIndex(p => p.id === id);
      if (index === -1) {
        return false;
      }

      this.customPresets[index] = {
        ...this.customPresets[index],
        ...updates,
        updatedAt: Date.now()
      };

      await this.saveCustomPresetsToStorage();
      return true;
    },

    /**
     * 删除预设
     */
    async deletePreset(id: string): Promise<boolean> {
      // 先检查自定义预设
      let customIndex = this.customPresets.findIndex(p => p.id === id);
      if (customIndex !== -1) {
        this.customPresets.splice(customIndex, 1);
        await this.saveCustomPresetsToStorage();
        return true;
      }

      // 检查导入的预设
      let importedIndex = this.importedPresets.findIndex(p => p.id === id);
      if (importedIndex !== -1) {
        this.importedPresets.splice(importedIndex, 1);
        await this.saveImportedPresetsToStorage();
        return true;
      }

      // 内置预设不能删除
      return false;
    },

    /**
     * 复制预设
     */
    async duplicatePreset(id: string): Promise<string | null> {
      const source = this.allPresets.find(p => p.id === id);
      if (!source) {
        return null;
      }

      const newId = `custom-${Date.now()}`;
      const newPreset: PackedPreset = {
        ...source,
        id: newId,
        name: `${source.name} (副本)`,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        preset: JSON.parse(JSON.stringify(source.preset))
      };

      // 根据源预设类型决定保存到哪个分类
      if (id.startsWith('builtin-') || id.startsWith('imported-')) {
        this.customPresets.push(newPreset);
        await this.saveCustomPresetsToStorage();
      } else {
        this.customPresets.push(newPreset);
        await this.saveCustomPresetsToStorage();
      }

      return newId;
    },

    /**
     * 导入 3FUI 格式预设
     */
    async importFrom3FUI(file: File): Promise<string[]> {
      const text = await file.text();
      const preset = presetConverter.convertFrom3FUI(text);

      if (!preset) {
        throw new Error('Failed to parse 3FUI preset file');
      }

      const metadata: PresetMetadata = {
        id: `imported-${Date.now()}`,
        name: preset.presetName || `Imported from ${file.name}`,
        description: 'Imported from FFmpegFreeUI',
        version: '1.0.0',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        tags: ['imported', '3fui']
      };

      const importedPreset: PackedPreset = {
        ...metadata,
        preset: preset.data
      };

      this.importedPresets.push(importedPreset);
      await this.saveImportedPresetsToStorage();

      return [metadata.id];
    },

    /**
     * 批量导入 3FUI 格式预设
     */
    async batchImportFrom3FUI(files: File[]): Promise<string[]> {
      const importedIds: string[] = [];

      for (const file of files) {
        try {
          const ids = await this.importFrom3FUI(file);
          importedIds.push(...ids);
        } catch (error) {
          console.error(`Failed to import ${file.name}:`, error);
          // 继续导入其他文件
        }
      }

      return importedIds;
    },

    /**
     * 导出预设为 JSON 格式
     */
    exportAsJSON(id: string): string {
      const preset = this.allPresets.find(p => p.id === id);
      if (!preset) {
        throw new Error('Preset not found');
      }

      return JSON.stringify(preset, null, 2);
    },

    /**
     * 导出预设为 3FUI 格式
     */
    exportAs3FUI(id: string): string {
      const preset = this.allPresets.find(p => p.id === id);
      if (!preset) {
        throw new Error('Preset not found');
      }

      return presetConverter.convertTo3FUI(preset);
    },

    /**
     * 批量导出预设
     */
    async batchExport(ids: string[], format: ExportFormat): Promise<Map<string, string>> {
      const result = new Map<string, string>();

      for (const id of ids) {
        try {
          const preset = this.allPresets.find(p => p.id === id);
          if (preset) {
            const content = format === '3fui'
              ? this.exportAs3FUI(id)
              : this.exportAsJSON(id);

            const filename = `${preset.name.replace(/[^a-zA-Z0-9_\-]/g, '_')}.${format}`;
            result.set(filename, content);
          }
        } catch (error) {
          console.error(`Failed to export preset ${id}:`, error);
        }
      }

      return result;
    },

    /**
     * 搜索预设
     */
    searchPresets(query: string): PackedPreset[] {
      const lowerQuery = query.toLowerCase();
      return this.allPresets.filter(p =>
        p.name.toLowerCase().includes(lowerQuery) ||
        (p.description && p.description.toLowerCase().includes(lowerQuery)) ||
        (p.tags && p.tags.some(tag => tag.toLowerCase().includes(lowerQuery)))
      );
    },

    /**
     * 按标签过滤预设
     */
    filterByTags(tags: string[]): PackedPreset[] {
      return this.allPresets.filter(p =>
        p.tags && tags.every((tag: string) => p.tags!.includes(tag))
      );
    },

    /**
     * 更新过滤条件
     */
    updateFilter(filter: Partial<PresetFilter>) {
      this.filter = { ...this.filter, ...filter };
    },

    /**
     * 重置过滤条件
     */
    resetFilter() {
      this.filter = {
        category: 'all',
        searchQuery: '',
        tags: []
      };
    },

    /**
     * 设置选中的预设
     */
    selectPreset(id: string) {
      this.selectedPresetId = id;
    },

    /**
     * 从本地存储加载自定义预设
     */
    async loadCustomPresets() {
      try {
        const stored = localStorage.getItem('rebebuca-ffmpeg-custom-presets');
        if (stored) {
          this.customPresets = JSON.parse(stored);
        }
      } catch (error) {
        console.error('Failed to load custom presets:', error);
      }
    },

    /**
     * 保存自定义预设到本地存储
     */
    async saveCustomPresetsToStorage() {
      try {
        localStorage.setItem(
          'rebebuca-ffmpeg-custom-presets',
          JSON.stringify(this.customPresets)
        );
      } catch (error) {
        console.error('Failed to save custom presets:', error);
        throw error;
      }
    },

    /**
     * 从本地存储加载导入的预设
     */
    async loadImportedPresets() {
      try {
        const stored = localStorage.getItem('rebebuca-ffmpeg-imported-presets');
        if (stored) {
          this.importedPresets = JSON.parse(stored);
        }
      } catch (error) {
        console.error('Failed to load imported presets:', error);
      }
    },

    /**
     * 保存导入的预设到本地存储
     */
    async saveImportedPresetsToStorage() {
      try {
        localStorage.setItem(
          'rebebuca-ffmpeg-imported-presets',
          JSON.stringify(this.importedPresets)
        );
      } catch (error) {
        console.error('Failed to save imported presets:', error);
        throw error;
      }
    },
  }
});
