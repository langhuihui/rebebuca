/**
 * 撤销/重做快捷键处理
 * 提供 Ctrl+Z (撤销) 和 Ctrl+Y/Ctrl+Shift+Z (重做) 功能
 */

import { onMounted, onUnmounted } from 'vue';
import { useFFmpegParamsStore } from '../stores/ffmpegParams';

/**
 * 检查当前焦点是否在输入元素中
 * 防止在输入框中触发撤销/重做
 */
function isInputFocused(): boolean {
  const activeElement = document.activeElement;

  if (!activeElement) {
    return false;
  }

  const tagName = activeElement.tagName.toLowerCase();
  const isInput =
    tagName === 'input' ||
    tagName === 'textarea' ||
    tagName === 'select' ||
    (activeElement as HTMLElement).isContentEditable;

  return isInput;
}

/**
 * 撤销/重做快捷键 Hook
 */
export function useHistoryShortcuts() {
  const store = useFFmpegParamsStore();

  /**
   * 处理键盘事件
   */
  const handleKeyDown = (event: KeyboardEvent) => {
    // 如果焦点在输入元素中，不处理快捷键
    if (isInputFocused()) {
      return;
    }

    // Ctrl+Z: 撤销
    if (event.ctrlKey && event.key === 'z' && !event.shiftKey) {
      event.preventDefault();

      if (store.canUndo) {
        store.undo();
      }
      return;
    }

    // Ctrl+Y 或 Ctrl+Shift+Z: 重做
    if (
      (event.ctrlKey && event.key === 'y') ||
      (event.ctrlKey && event.shiftKey && event.key === 'Z')
    ) {
      event.preventDefault();

      if (store.canRedo) {
        store.redo();
      }
      return;
    }
  };

  /**
   * 挂载快捷键监听
   */
  onMounted(() => {
    document.addEventListener('keydown', handleKeyDown);
  });

  /**
   * 卸载快捷键监听
   */
  onUnmounted(() => {
    document.removeEventListener('keydown', handleKeyDown);
  });

  return {
    undo: () => store.undo(),
    redo: () => store.redo(),
    canUndo: () => store.canUndo,
    canRedo: () => store.canRedo
  };
}

/**
 * 检查是否可以触发撤销/重做快捷键
 * 用于组件中的条件渲染或禁用状态
 */
export function canTriggerHistoryShortcuts(): boolean {
  return !isInputFocused();
}
