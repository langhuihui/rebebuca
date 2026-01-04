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
  <div 
    class="terminal-container" 
    ref="terminalContainer"
    @dragover.prevent="handleDragOver"
    @dragleave="handleDragLeave"
    @drop.prevent="handleDrop"
    :class="{ 'drag-over': isDragOver }"
  ></div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, nextTick } from 'vue';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { getAdapter, isTauri, type BackendAdapter } from '../adapters';
import '@xterm/xterm/css/xterm.css';

// Adapter instance
let adapter: BackendAdapter | null = null;

const getAdapterInstance = async (): Promise<BackendAdapter> => {
  if (!adapter) {
    adapter = await getAdapter();
  }
  return adapter;
};

interface Props {
  ptyId: string;
  cwd?: string;
  env?: Record<string, string>;
  theme?: 'dark' | 'light';
  /** If true, PTY already exists (task mode). If false, create a new shell PTY */
  attachOnly?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  theme: 'dark',
  attachOnly: false,
});

const emit = defineEmits<{
  (e: 'ready'): void;
  (e: 'exit', exitCode: number | null): void;
  (e: 'error', error: string): void;
}>();

const terminalContainer = ref<HTMLDivElement | null>(null);
const isDragOver = ref(false);

let terminal: Terminal | null = null;
let fitAddon: FitAddon | null = null;
let unlistenOutput: (() => void) | null = null;
let unlistenExit: (() => void) | null = null;
let unlistenDragDrop: (() => void) | null = null;
let resizeObserver: ResizeObserver | null = null;
let isInitialized = false;

// Terminal theme configurations
const darkTheme = {
  background: '#1a1a1a',
  foreground: '#c0c0c0',
  cursor: '#00d084',
  cursorAccent: '#1a1a1a',
  selectionBackground: 'rgba(0, 208, 132, 0.3)',
  black: '#000000',
  red: '#ff5555',
  green: '#50fa7b',
  yellow: '#f1fa8c',
  blue: '#bd93f9',
  magenta: '#ff79c6',
  cyan: '#8be9fd',
  white: '#bbbbbb',
  brightBlack: '#555555',
  brightRed: '#ff6e6e',
  brightGreen: '#69ff94',
  brightYellow: '#ffffa5',
  brightBlue: '#d6acff',
  brightMagenta: '#ff92df',
  brightCyan: '#a4ffff',
  brightWhite: '#ffffff',
};

const lightTheme = {
  background: '#ffffff',
  foreground: '#333333',
  cursor: '#00d084',
  cursorAccent: '#ffffff',
  selectionBackground: 'rgba(0, 208, 132, 0.3)',
  black: '#000000',
  red: '#c91b00',
  green: '#00c200',
  yellow: '#c7c400',
  blue: '#0225c7',
  magenta: '#c930c7',
  cyan: '#00c5c7',
  white: '#c7c7c7',
  brightBlack: '#676767',
  brightRed: '#ff6d67',
  brightGreen: '#5ff967',
  brightYellow: '#fefb67',
  brightBlue: '#6871ff',
  brightMagenta: '#ff76ff',
  brightCyan: '#5ffdff',
  brightWhite: '#fffefe',
};

const initTerminal = async () => {
  if (!terminalContainer.value || isInitialized) return;

  const adapterInstance = await getAdapterInstance();

  // Create terminal instance
  terminal = new Terminal({
    cursorBlink: true,
    cursorStyle: 'block',
    fontSize: 14,
    fontFamily: '"Cascadia Code", "Fira Code", "Source Code Pro", Menlo, Monaco, "Courier New", monospace',
    theme: props.theme === 'dark' ? darkTheme : lightTheme,
    allowProposedApi: true,
    scrollback: 10000,
  });

  // Add addons
  fitAddon = new FitAddon();
  terminal.loadAddon(fitAddon);

  const webLinksAddon = new WebLinksAddon(async (_event, uri) => {
    // Use adapter to open URL in system browser
    try {
      await adapterInstance.system.openExternal(uri);
    } catch (error) {
      console.error('Failed to open URL:', error);
      // Fallback to window.open
      window.open(uri, '_blank');
    }
  });
  terminal.loadAddon(webLinksAddon);

  // Open terminal in container
  terminal.open(terminalContainer.value);
  
  // Fit terminal to container
  await nextTick();
  fitAddon.fit();
  
  // Get terminal dimensions (with fallback defaults)
  const cols = terminal.cols || 80;
  const rows = terminal.rows || 24;
  
  // Focus terminal after opening
  terminal.focus();
  
  try {
    // Only create PTY if not in attach-only mode
    if (!props.attachOnly) {
      // For shell PTY, we need to use invoke directly since adapter.terminal.create is for task execution
      if (isTauri()) {
        const { invoke } = await import('@tauri-apps/api/core');
        await invoke('create_pty', {
          ptyId: props.ptyId,
          options: {
            rows,
            cols,
            cwd: props.cwd,
            env: props.env,
          },
        });
      }
    } else {
      // In attach mode, just resize to fit
      try {
        await adapterInstance.terminal.resize(props.ptyId, cols, rows);
      } catch (e) {
        // Ignore resize errors for already-exited tasks
        const errStr = String(e);
        if (errStr.includes('PTY not found') || errStr.includes('not found')) {
          console.debug('PTY already exited during init, resize skipped');
        } else {
          console.warn('Failed to resize PTY (may have exited):', e);
        }
      }
    }

    // Listen for PTY output - use global listener and filter by ptyId
    const outputUnlisten = adapterInstance.terminal.onData((event) => {
      if (event.ptyId === props.ptyId && terminal) {
        terminal.write(event.data);
      }
    });
    unlistenOutput = outputUnlisten;

    // Listen for PTY exit
    const exitUnlisten = adapterInstance.terminal.onExit((event) => {
      if (event.ptyId === props.ptyId) {
        emit('exit', event.exitCode);
      }
    });
    unlistenExit = exitUnlisten;

    // Handle user input
    terminal.onData((data) => {
      adapterInstance.terminal.write(props.ptyId, data).catch((err: Error) => {
        console.error('Failed to write to PTY:', err);
      });
    });

    // Handle resize
    terminal.onResize(({ cols, rows }) => {
      adapterInstance.terminal.resize(props.ptyId, cols, rows).catch((err: Error) => {
        // Ignore "PTY not found" errors - this happens when process exits quickly
        const errStr = String(err);
        if (errStr.includes('PTY not found') || errStr.includes('not found')) {
          console.debug('PTY already exited, resize skipped');
        } else {
          console.error('Failed to resize PTY:', err);
        }
      });
    });

    // Setup resize observer
    resizeObserver = new ResizeObserver(() => {
      if (fitAddon && terminal) {
        fitAddon.fit();
      }
    });
    resizeObserver.observe(terminalContainer.value);

    isInitialized = true;
    emit('ready');
  } catch (error) {
    console.error('Failed to initialize terminal:', error);
    emit('error', String(error));
  }
};

const dispose = async () => {
  if (unlistenOutput) {
    unlistenOutput();
    unlistenOutput = null;
  }

  if (unlistenExit) {
    unlistenExit();
    unlistenExit = null;
  }

  if (resizeObserver) {
    resizeObserver.disconnect();
    resizeObserver = null;
  }

  if (terminal) {
    terminal.dispose();
    terminal = null;
  }

  // Only close PTY if we created it (not in attach mode)
  if (isInitialized && !props.attachOnly) {
    try {
      if (isTauri()) {
        const { invoke } = await import('@tauri-apps/api/core');
        await invoke('close_pty', { ptyId: props.ptyId });
      }
    } catch (error) {
      console.error('Failed to close PTY:', error);
    }
  }
  isInitialized = false;
};

// Watch for theme changes
watch(
  () => props.theme,
  (newTheme) => {
    if (terminal) {
      terminal.options.theme = newTheme === 'dark' ? darkTheme : lightTheme;
    }
  }
);

// Public methods
const focus = () => {
  terminal?.focus();
};

const fit = () => {
  fitAddon?.fit();
};

const clear = () => {
  terminal?.clear();
};

const write = (data: string) => {
  terminal?.write(data);
};

const writeln = (data: string) => {
  terminal?.writeln(data);
};

// Escape path for shell (handle spaces and special characters)
const escapePathForShell = (path: string): string => {
  // If path contains spaces or special characters, quote it
  if (/[\s'"\\$`!]/.test(path)) {
    // Use single quotes and escape any single quotes in the path
    return `'${path.replace(/'/g, "'\\''")}'`;
  }
  return path;
};

// Drag and drop handlers
const handleDragOver = (event: DragEvent) => {
  isDragOver.value = true;
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = 'copy';
  }
};

const handleDragLeave = () => {
  isDragOver.value = false;
};

const handleDrop = async (event: DragEvent) => {
  // Browser drop events don't contain file paths in Tauri
  // We use Tauri's drag-drop events instead (setupDragDropListener)
  event.preventDefault();
};

// Write file paths to PTY
const writePathsToPty = async (paths: string[]) => {
  if (paths.length === 0) return;
  
  const escapedPaths = paths.map(escapePathForShell).join(' ');
  
  try {
    const adapterInstance = await getAdapterInstance();
    await adapterInstance.terminal.write(props.ptyId, escapedPaths);
    
    // Focus terminal after drop
    terminal?.focus();
  } catch (err) {
    console.error('Failed to write dropped paths to PTY:', err);
  }
};

// Setup Tauri drag-drop event listener
const setupDragDropListener = async () => {
  if (!isTauri()) {
    // In non-Tauri environment, skip drag-drop setup
    return;
  }
  
  try {
    const { getCurrentWindow } = await import('@tauri-apps/api/window');
    const { TauriEvent } = await import('@tauri-apps/api/event');
    const appWindow = getCurrentWindow();
    
    // Listen for drag enter
    const unlistenEnter = await appWindow.listen<{ paths: string[]; position: { x: number; y: number } }>(
      TauriEvent.DRAG_ENTER,
      (event) => {
        if (terminalContainer.value && isDropOverElement(event.payload.position)) {
          isDragOver.value = true;
        }
      }
    );
    
    // Listen for drag over (to update position)
    const unlistenOver = await appWindow.listen<{ paths: string[]; position: { x: number; y: number } }>(
      TauriEvent.DRAG_OVER,
      (event) => {
        if (terminalContainer.value) {
          isDragOver.value = isDropOverElement(event.payload.position);
        }
      }
    );
    
    // Listen for drag leave
    const unlistenLeave = await appWindow.listen(
      TauriEvent.DRAG_LEAVE,
      () => {
        isDragOver.value = false;
      }
    );
    
    // Listen for actual drop
    const unlistenDrop = await appWindow.listen<{ paths: string[]; position: { x: number; y: number } }>(
      TauriEvent.DRAG_DROP,
      async (event) => {
        isDragOver.value = false;
        
        if (terminalContainer.value && isDropOverElement(event.payload.position)) {
          await writePathsToPty(event.payload.paths);
        }
      }
    );
    
    // Store cleanup function
    unlistenDragDrop = () => {
      unlistenEnter();
      unlistenOver();
      unlistenLeave();
      unlistenDrop();
    };
  } catch (error) {
    console.warn('Failed to setup drag-drop listener:', error);
  }
};

// Check if the drop position is over this terminal element
const isDropOverElement = (position: { x: number; y: number }): boolean => {
  if (!terminalContainer.value) return false;
  
  const rect = terminalContainer.value.getBoundingClientRect();
  return (
    position.x >= rect.left &&
    position.x <= rect.right &&
    position.y >= rect.top &&
    position.y <= rect.bottom
  );
};

defineExpose({
  focus,
  fit,
  clear,
  write,
  writeln,
});

onMounted(() => {
  initTerminal();
  setupDragDropListener();
});

onUnmounted(() => {
  if (unlistenDragDrop) {
    unlistenDragDrop();
    unlistenDragDrop = null;
  }
  dispose();
});
</script>

<style scoped>
.terminal-container {
  width: 100%;
  height: 100%;
  padding: 8px;
  box-sizing: border-box;
  background-color: v-bind('props.theme === "dark" ? "#1a1a1a" : "#ffffff"');
  border-radius: 6px;
  transition: box-shadow 0.2s, border-color 0.2s;
  border: 2px solid transparent;
}

/* Drag over visual feedback */
.terminal-container.drag-over {
  border-color: #00d084;
  box-shadow: inset 0 0 20px rgba(0, 208, 132, 0.2);
}

.terminal-container :deep(.xterm) {
  height: 100%;
}

.terminal-container :deep(.xterm-viewport) {
  overflow-y: auto;
}

/* Hide scrollbar but keep functionality */
.terminal-container :deep(.xterm-viewport::-webkit-scrollbar) {
  width: 8px;
}

.terminal-container :deep(.xterm-viewport::-webkit-scrollbar-track) {
  background: transparent;
}

.terminal-container :deep(.xterm-viewport::-webkit-scrollbar-thumb) {
  background-color: rgba(128, 128, 128, 0.3);
  border-radius: 4px;
}

.terminal-container :deep(.xterm-viewport::-webkit-scrollbar-thumb:hover) {
  background-color: rgba(128, 128, 128, 0.5);
}
</style>
