import { ref, watch, type Ref } from 'vue';
import {
  getNextDirectoryFromInput,
  type DirectoryPickerEntry,
} from '../utils/pathUtils';

export function useDirectoryInputNavigation(options: {
  currentPath: Ref<string>;
  inputPath: Ref<string>;
  entries: Ref<DirectoryPickerEntry[]>;
  loading: Ref<boolean>;
  loadDirectory: (path: string, opts?: { preserveInput?: boolean }) => Promise<void>;
}) {
  const isNavigatingFromInput = ref(false);

  const applyInputNavigation = async () => {
    if (isNavigatingFromInput.value) return;

    let nextPath = getNextDirectoryFromInput(
      options.inputPath.value,
      options.currentPath.value,
      options.entries.value
    );

    while (nextPath) {
      isNavigatingFromInput.value = true;
      try {
        await options.loadDirectory(nextPath, { preserveInput: true });
      } finally {
        isNavigatingFromInput.value = false;
      }

      if (options.loading.value) break;

      nextPath = getNextDirectoryFromInput(
        options.inputPath.value,
        options.currentPath.value,
        options.entries.value
      );
    }
  };

  watch(options.inputPath, () => {
    void applyInputNavigation();
  });

  return { isNavigatingFromInput, applyInputNavigation };
}
