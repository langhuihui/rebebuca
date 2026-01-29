/**
 * ExampleLibrary 组件单元测试
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { NButton, NInput, NTag, NScrollbar, NEmpty, NModal, NCode, NSpace } from 'naive-ui';
import ExampleLibrary from './ExampleLibrary.vue';
import examplesData from '@/ffmpeg/data/examples.json';

describe('ExampleLibrary.vue', () => {
  const mockExamples = examplesData.examples;

  it('应该正确渲染示例列表', () => {
    const wrapper = mount(ExampleLibrary, {
      props: {
        examples: mockExamples
      },
      global: {
        components: {
          NButton,
          NInput,
          NTag,
          NScrollbar,
          NEmpty,
          NModal,
          NCode,
          NSpace
        }
      }
    });

    expect(wrapper.find('.example-library').exists()).toBe(true);
    expect(wrapper.findAll('.example-item')).toHaveLength(mockExamples.length);
  });

  it('应该支持搜索过滤', async () => {
    const wrapper = mount(ExampleLibrary, {
      props: {
        examples: mockExamples
      },
      global: {
        components: {
          NButton,
          NInput,
          NTag,
          NScrollbar,
          NEmpty,
          NModal,
          NCode,
          NSpace
        }
      }
    });

    const searchInput = wrapper.find('.search-input input');
    await searchInput.setValue('缩放');
    await wrapper.vm.$nextTick();

    expect(wrapper.findAll('.example-item').length).toBeGreaterThan(0);
    expect(wrapper.findAll('.example-item').length).toBeLessThan(mockExamples.length);
  });

  it('应该支持分类过滤', async () => {
    const wrapper = mount(ExampleLibrary, {
      props: {
        examples: mockExamples
      },
      global: {
        components: {
          NButton,
          NInput,
          NTag,
          NScrollbar,
          NEmpty,
          NModal,
          NCode,
          NSpace
        }
      }
    });

    // 点击基础分类
    const basicButton = wrapper.findAll('.category-tabs button')[1];
    await basicButton.trigger('click');
    await wrapper.vm.$nextTick();

    const filteredExamples = mockExamples.filter(ex => ex.category === 'basic');
    expect(wrapper.findAll('.example-item')).toHaveLength(filteredExamples.length);
  });

  it('应该触发加载示例事件', async () => {
    const wrapper = mount(ExampleLibrary, {
      props: {
        examples: mockExamples
      },
      global: {
        components: {
          NButton,
          NInput,
          NTag,
          NScrollbar,
          NEmpty,
          NModal,
          NCode,
          NSpace
        }
      }
    });

    // 点击第一个示例
    const firstExampleItem = wrapper.find('.example-item');
    await firstExampleItem.trigger('click');
    await wrapper.vm.$nextTick();

    // 模拟确认加载
    const loadButton = wrapper.find('.example-detail button[type="primary"]');
    await loadButton.trigger('click');

    expect(wrapper.emitted('load-example')).toBeTruthy();
  });
});
