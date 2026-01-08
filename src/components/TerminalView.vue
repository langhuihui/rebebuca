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
  <div class="terminal-wrapper" :class="{ 'drag-over': isDragOver }">
    <!-- Search bar -->
    <div v-if="showSearch" class="terminal-search-bar">
      <input
        ref="searchInput"
        v-model="searchQuery"
        type="text"
        placeholder="Search..."
        @keydown.enter="findNext"
        @keydown.shift.enter="findPrevious"
        @keydown.escape="closeSearch"
        class="search-input"
      />
      <span v-if="searchResultCount !== null" class="search-count">
        {{ searchResultIndex !== null ? searchResultIndex + 1 : 0 }}/{{ searchResultCount }}
      </span>
      <button @click="findPrevious" class="search-btn" title="Previous (Shift+Enter)">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="18 15 12 9 6 15"></polyline>
        </svg>
      </button>
      <button @click="findNext" class="search-btn" title="Next (Enter)">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
      </button>
      <button @click="closeSearch" class="search-btn" title="Close (Esc)">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
    </div>
    <!-- Terminal container -->
    <div 
      class="terminal-container" 
      ref="terminalContainer"
      @dragover.prevent="handleDragOver"
      @dragleave="handleDragLeave"
      @drop.prevent="handleDrop"
    ></div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, nextTick } from 'vue';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { WebglAddon } from '@xterm/addon-webgl';
import { SearchAddon } from '@xterm/addon-search';
import { getAdapter, isTauri, type BackendAdapter } from '../adapters';
import { ShellIntegration, type CommandInfo } from '../utils/shellIntegration';
import { useSettingsStore } from '../stores/settings';
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
  (e: 'cwd-change', cwd: string): void;
  (e: 'command-start', command: CommandInfo): void;
  (e: 'command-end', command: CommandInfo): void;
}>();

const terminalContainer = ref<HTMLDivElement | null>(null);
const searchInput = ref<HTMLInputElement | null>(null);
const isDragOver = ref(false);
const showSearch = ref(false);
const searchQuery = ref('');
const searchResultCount = ref<number | null>(null);
const searchResultIndex = ref<number | null>(null);

let terminal: Terminal | null = null;
let fitAddon: FitAddon | null = null;
let webglAddon: WebglAddon | null = null;
let searchAddon: SearchAddon | null = null;
let shellIntegration: ShellIntegration | null = null;
let unlistenOutput: (() => void) | null = null;
let unlistenExit: (() => void) | null = null;
let unlistenDragDrop: (() => void) | null = null;
let resizeObserver: ResizeObserver | null = null;
let intersectionObserver: IntersectionObserver | null = null;
let mutationObserver: MutationObserver | null = null;
let isInitialized = false;
let wasHidden = false;

// WebGL setting - enabled for better performance
const USE_WEBGL = true;

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
  if (!terminalContainer.value || isInitialized) {
    console.log('[TerminalView] Skipping initTerminal - container:', !!terminalContainer.value, 'initialized:', isInitialized);
    return;
  }

  console.log('[TerminalView] Initializing terminal for ptyId:', props.ptyId);
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

  // Add search addon
  searchAddon = new SearchAddon();
  terminal.loadAddon(searchAddon);

  // Setup shell integration (for shell PTY only, not task PTY)
  if (!props.attachOnly) {
    shellIntegration = new ShellIntegration(terminal);
    shellIntegration.setOnCwdChange((cwd) => {
      emit('cwd-change', cwd);
    });
    shellIntegration.setOnCommandStart((command) => {
      emit('command-start', command);
    });
    shellIntegration.setOnCommandEnd((command) => {
      emit('command-end', command);
    });
  }

  // Open terminal in container - check again as component might be unmounted during async operations
  if (!terminalContainer.value) {
    console.warn('[TerminalView] Container element not found, aborting terminal initialization');
    terminal?.dispose();
    terminal = null;
    return;
  }
  
  terminal.open(terminalContainer.value);
  
  // Try to enable WebGL renderer for better performance
  // However, WebGL can lose context when element is hidden (v-show)
  // Disabling WebGL by default to avoid rendering issues when switching tabs
  // Canvas renderer is more stable and doesn't have context loss issues
  if (USE_WEBGL) {
    try {
      webglAddon = new WebglAddon();
      webglAddon.onContextLoss(() => {
        // WebGL context lost, fall back to canvas renderer
        console.warn('[Terminal] WebGL context lost, falling back to canvas renderer');
        webglAddon?.dispose();
        webglAddon = null;
        // Force refresh terminal after context loss
        if (terminal && fitAddon) {
          nextTick(() => {
            fitAddon.fit();
            if (terminal.rows > 0) {
              terminal.refresh(0, terminal.rows - 1);
            }
          });
        }
      });
      terminal.loadAddon(webglAddon);
      console.log('[Terminal] WebGL renderer enabled');
    } catch (e) {
      console.warn('[Terminal] WebGL not available, using canvas renderer:', e);
    }
  } else {
    console.log('[Terminal] Using canvas renderer (WebGL disabled to avoid rendering issues with tab switching)');
  }
  
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
        const settingsStore = useSettingsStore();
        await invoke('create_pty', {
          ptyId: props.ptyId,
          options: {
            rows,
            cols,
            cwd: props.cwd,
            env: props.env,
            shell: settingsStore.settings.preferredShell || null,  // Use preferred shell if set
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
        // Process data through shell integration if available
        let data = event.data;
        if (shellIntegration) {
          data = shellIntegration.processData(data);
        }
        terminal.write(data);
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

    // Setup intersection observer to detect visibility changes (v-show)
    // This helps restore rendering when tab is switched back
    // Note: This is a backup mechanism, the main restoration happens via restoreRenderer() called from ConsoleArea
    intersectionObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.intersectionRatio > 0) {
            // Element is now visible
            if (wasHidden && terminal) {
              console.log('[TerminalView] Element became visible (via IntersectionObserver), restoring renderer');
              wasHidden = false;
              // Use the restoreRenderer method for consistency
              restoreRenderer();
            }
          } else if (!entry.isIntersecting || entry.intersectionRatio === 0) {
            // Element is now hidden
            wasHidden = true;
          }
        });
      },
      { threshold: 0 }
    );
    if (terminalContainer.value) {
      intersectionObserver.observe(terminalContainer.value);
    }
    
    // Also use MutationObserver to watch for style changes (v-show changes display property)
    if (terminalContainer.value?.parentElement) {
      mutationObserver = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
            const target = mutation.target as HTMLElement;
            const isVisible = target.style.display !== 'none' && 
                             target.style.visibility !== 'hidden' &&
                             !target.hasAttribute('hidden');
            
            if (isVisible && wasHidden && terminal) {
              console.log('[TerminalView] Element became visible (via MutationObserver), restoring renderer');
              wasHidden = false;
              restoreRenderer();
            } else if (!isVisible) {
              wasHidden = true;
            }
          }
        });
      });
      
      // Observe the parent element for style changes on the terminal container
      mutationObserver.observe(terminalContainer.value.parentElement, {
        attributes: true,
        attributeFilter: ['style', 'class'],
        subtree: true,
        childList: false
      });
      
      // Also observe the terminal container itself
      mutationObserver.observe(terminalContainer.value, {
        attributes: true,
        attributeFilter: ['style', 'class']
      });
    }

    // Setup keyboard shortcuts
    setupKeyboardShortcuts();

    isInitialized = true;
    console.log('[TerminalView] Terminal initialized successfully, buffer length:', terminal.buffer.active.length);
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

  if (intersectionObserver) {
    intersectionObserver.disconnect();
    intersectionObserver = null;
  }

  if (mutationObserver) {
    mutationObserver.disconnect();
    mutationObserver = null;
  }

  if (webglAddon) {
    webglAddon.dispose();
    webglAddon = null;
  }

  if (searchAddon) {
    searchAddon = null;
  }

  if (shellIntegration) {
    shellIntegration.dispose();
    shellIntegration = null;
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
      // Ignore "PTY not found" errors - PTY was already closed
      const errorMsg = String(error);
      if (!errorMsg.includes('PTY not found') && !errorMsg.includes('not found')) {
        console.error('Failed to close PTY:', error);
      }
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
  console.log('[TerminalView] clear() called for ptyId:', props.ptyId);
  terminal?.clear();
};

// Force restore rendering after visibility change
// This should only refresh the renderer, not recreate the terminal instance
const restoreRenderer = () => {
  if (!terminal || !terminalContainer.value) {
    console.warn('[TerminalView] Cannot restore: terminal or container not available');
    return;
  }
  
  console.log('[TerminalView] Restoring renderer for terminal:', props.ptyId);
  console.log('[TerminalView] Terminal buffer active length:', terminal.buffer.active.length);
  console.log('[TerminalView] Terminal buffer normal length:', terminal.buffer.normal.length);
  
  // Check if terminal has any content
  const hasContent = terminal.buffer.active.length > 0 || terminal.buffer.normal.length > 0;
  console.log('[TerminalView] Terminal has content:', hasContent);
  
  if (hasContent) {
    // Log some buffer content for debugging
    try {
      const activeBuffer = terminal.buffer.active;
      if (activeBuffer.length > 0) {
        const firstLine = activeBuffer.getLine(0);
        const lastLine = activeBuffer.getLine(Math.min(activeBuffer.length - 1, terminal.rows - 1));
        console.log('[TerminalView] First line content:', firstLine?.translateToString(true));
        console.log('[TerminalView] Last line content:', lastLine?.translateToString(true));
      }
    } catch (e) {
      console.warn('[TerminalView] Could not read buffer content:', e);
    }
  } else {
    console.warn('[TerminalView] WARNING: Terminal has no content in buffer!');
  }
  
  // Check if element is actually visible
  const element = terminal.element;
  if (element) {
    const style = window.getComputedStyle(element);
    const isVisible = style.display !== 'none' && 
                      style.visibility !== 'hidden' &&
                      style.opacity !== '0';
    
    if (!isVisible) {
      console.warn('[TerminalView] Element is not visible yet, waiting...');
      setTimeout(() => restoreRenderer(), 100);
      return;
    }
  }
  
  // Re-fit the terminal first to ensure dimensions are correct
  nextTick(() => {
    if (!terminal || !fitAddon) {
      console.warn('[TerminalView] Terminal or fitAddon not available');
      return;
    }
    
    try {
      fitAddon.fit();
      console.log('[TerminalView] Terminal fitted, cols:', terminal.cols, 'rows:', terminal.rows);
    } catch (e) {
      console.error('[TerminalView] Error fitting terminal:', e);
      return;
    }
    
    // Wait for DOM to settle, then restore WebGL and refresh
    setTimeout(() => {
      if (!terminal) return;
      
      // If WebGL was enabled but lost, try to restore it
      if (USE_WEBGL && !webglAddon) {
        try {
          console.log('[TerminalView] Recreating WebGL addon');
          webglAddon = new WebglAddon();
          webglAddon.onContextLoss(() => {
            console.warn('[TerminalView] WebGL context lost again');
            webglAddon?.dispose();
            webglAddon = null;
          });
          terminal.loadAddon(webglAddon);
          console.log('[TerminalView] WebGL addon recreated');
          
          // Fit again after WebGL is loaded
          if (fitAddon && terminal) {
            fitAddon.fit();
          }
        } catch (e) {
          console.warn('[TerminalView] Failed to recreate WebGL:', e);
        }
      }
      
      // Force refresh the entire viewport - try multiple methods
      try {
        if (terminal.rows > 0) {
          // Method 1: Standard refresh
          terminal.refresh(0, terminal.rows - 1);
          
          // Method 2: Force refresh via renderer
          try {
            const renderer = (terminal as any).renderer;
            if (renderer) {
              // Force render service to refresh
              if (renderer._renderService) {
                const renderService = renderer._renderService;
                
                // Force render all rows (DON'T clear, just refresh)
                if (renderService._renderer) {
                  const rendererInstance = renderService._renderer;
                  
                  // Force render all rows from buffer
                  if (rendererInstance.renderRows) {
                    rendererInstance.renderRows(0, terminal.rows - 1);
                  }
                  
                  // Also try refreshRows
                  if (renderService.refreshRows) {
                    renderService.refreshRows(0, terminal.rows - 1);
                  }
                }
                
                // Trigger refresh event
                if (renderService.onRequestRefreshRows) {
                  renderService.onRequestRefreshRows.fire({ start: 0, end: terminal.rows - 1 });
                }
              }
              
              // Trigger resize event
              if (renderer.onResize) {
                renderer.onResize.fire({ cols: terminal.cols, rows: terminal.rows });
              }
            }
          } catch (rendererError) {
            console.warn('[TerminalView] Could not access renderer directly:', rendererError);
          }
          
          // Method 3: Trigger a resize event on the window
          window.dispatchEvent(new Event('resize'));
          
          console.log('[TerminalView] Terminal refreshed using multiple methods');
        }
      } catch (e) {
        console.warn('[TerminalView] Error refreshing terminal:', e);
      }
      
      // Final fit and focus
      setTimeout(() => {
        if (terminal && fitAddon) {
          fitAddon.fit();
          
          // One more refresh after fit
          if (terminal.rows > 0) {
            terminal.refresh(0, terminal.rows - 1);
          }
          
          terminal.focus();
          console.log('[TerminalView] Terminal fitted and focused');
          
          // Final check - log buffer length again
          console.log('[TerminalView] Final buffer length after restore:', terminal.buffer.active.length);
        }
      }, 100);
    }, 200);
  });
};

const write = (data: string) => {
  terminal?.write(data);
};

const writeln = (data: string) => {
  terminal?.writeln(data);
};

// Search functionality
const openSearch = () => {
  showSearch.value = true;
  nextTick(() => {
    searchInput.value?.focus();
    searchInput.value?.select();
  });
};

const closeSearch = () => {
  showSearch.value = false;
  searchQuery.value = '';
  searchResultCount.value = null;
  searchResultIndex.value = null;
  searchAddon?.clearDecorations();
  terminal?.focus();
};

const findNext = () => {
  if (!searchAddon || !searchQuery.value) return;
  const result = searchAddon.findNext(searchQuery.value, {
    decorations: {
      matchBackground: '#515c6a',
      activeMatchBackground: '#00d084',
      matchOverviewRuler: '#00d084',
      activeMatchColorOverviewRuler: '#00d084',
    }
  });
  updateSearchResults();
  return result;
};

const findPrevious = () => {
  if (!searchAddon || !searchQuery.value) return;
  const result = searchAddon.findPrevious(searchQuery.value, {
    decorations: {
      matchBackground: '#515c6a',
      activeMatchBackground: '#00d084',
      matchOverviewRuler: '#00d084',
      activeMatchColorOverviewRuler: '#00d084',
    }
  });
  updateSearchResults();
  return result;
};

const updateSearchResults = () => {
  // Note: SearchAddon doesn't expose result count directly
  // This is a limitation - we can only show if there are matches or not
  if (searchQuery.value && searchAddon) {
    // We'll just indicate search is active
    searchResultCount.value = -1; // -1 means "searching"
    searchResultIndex.value = null;
  } else {
    searchResultCount.value = null;
    searchResultIndex.value = null;
  }
};

// Watch search query changes
watch(searchQuery, (newQuery) => {
  if (newQuery) {
    findNext();
  } else {
    searchAddon?.clearDecorations();
    searchResultCount.value = null;
    searchResultIndex.value = null;
  }
});

// Setup keyboard shortcuts
const setupKeyboardShortcuts = () => {
  if (!terminal) return;
  
  // Add custom key handler for shortcuts
  terminal.attachCustomKeyEventHandler((event) => {
    // Cmd+F (Mac) or Ctrl+F (Windows/Linux) - open search
    if ((event.metaKey || event.ctrlKey) && event.key === 'f') {
      event.preventDefault();
      openSearch();
      return false;
    }
    
    // Escape - close search if open
    if (event.key === 'Escape' && showSearch.value) {
      closeSearch();
      return false;
    }
    
    // Cmd/Ctrl+Up - navigate to previous command
    if ((event.metaKey || event.ctrlKey) && event.key === 'ArrowUp' && event.type === 'keydown') {
      if (shellIntegration?.navigateToPreviousCommand()) {
        event.preventDefault();
        return false;
      }
    }
    
    // Cmd/Ctrl+Down - navigate to next command
    if ((event.metaKey || event.ctrlKey) && event.key === 'ArrowDown' && event.type === 'keydown') {
      if (shellIntegration?.navigateToNextCommand()) {
        event.preventDefault();
        return false;
      }
    }
    
    return true;
  });
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

// Command navigation
const navigateToPreviousCommand = () => {
  return shellIntegration?.navigateToPreviousCommand() ?? false;
};

const navigateToNextCommand = () => {
  return shellIntegration?.navigateToNextCommand() ?? false;
};

const getCommands = () => {
  return shellIntegration?.getCommands() ?? [];
};

const getCwd = () => {
  return shellIntegration?.getCwd();
};

const isShellIntegrationActive = () => {
  return shellIntegration?.isActive() ?? false;
};

defineExpose({
  focus,
  fit,
  clear,
  write,
  writeln,
  openSearch,
  closeSearch,
  findNext,
  findPrevious,
  navigateToPreviousCommand,
  navigateToNextCommand,
  getCommands,
  getCwd,
  isShellIntegrationActive,
  restoreRenderer,
});

onMounted(() => {
  console.log('[TerminalView] Component mounted for ptyId:', props.ptyId);
  initTerminal();
  setupDragDropListener();
});

// Watch for ptyId changes (restart task scenario)
// IMPORTANT: Only reinitialize if terminal is not already initialized with content
// When startTask updates ptyId from "task-xxx" to actual ptyId, we should NOT reinitialize
// if terminal already exists and has content
watch(() => props.ptyId, async (newPtyId, oldPtyId) => {
  if (newPtyId && oldPtyId && newPtyId !== oldPtyId) {
    // Check if this is just a ptyId update (from "task-xxx" to actual ptyId) after task start
    // vs a real restart (terminal should be reinitialized)
    const isPtyIdUpdate = oldPtyId.startsWith('task-') && terminal && isInitialized;
    const hasContent = terminal && terminal.buffer.active.length > 0;
    
    if (isPtyIdUpdate && hasContent) {
      // This is just a ptyId update after task start, don't reinitialize
      // Just update the ptyId reference but keep the terminal instance
      console.log('[TerminalView] PTY ID updated from placeholder to actual:', oldPtyId, '->', newPtyId);
      console.log('[TerminalView] Keeping existing terminal with content, buffer length:', terminal.buffer.active.length);
      return;
    }
    
    // This is a real restart - dispose old connection and reinitialize
    console.log('[TerminalView] PTY ID changed (real restart), reinitializing:', oldPtyId, '->', newPtyId);
    console.log('[TerminalView] Buffer length before dispose:', terminal?.buffer.active.length);

    // Force close old PTY (even in attach mode)
    if (isTauri()) {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        await invoke('close_pty', { ptyId: oldPtyId });
        console.log('[TerminalView] Closed old PTY:', oldPtyId);
      } catch (error) {
        // Ignore "PTY not found" errors - PTY was already closed
        const errorMsg = String(error);
        if (!errorMsg.includes('PTY not found') && !errorMsg.includes('not found')) {
          console.error('[TerminalView] Failed to close old PTY:', error);
        }
      }
    }

    await dispose();
    await nextTick();
    initTerminal();
  } else if (newPtyId === oldPtyId && newPtyId) {
    // Same ptyId - this is normal tab switching, don't reinitialize
    console.log('[TerminalView] PTY ID unchanged during tab switch:', newPtyId, 'terminal exists:', !!terminal);
  }
});

onUnmounted(() => {
  console.log('[TerminalView] Component unmounted for ptyId:', props.ptyId, 'buffer length before dispose:', terminal?.buffer.active.length);
  if (unlistenDragDrop) {
    unlistenDragDrop();
    unlistenDragDrop = null;
  }
  dispose();
});
</script>

<style scoped>
.terminal-wrapper {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background-color: v-bind('props.theme === "dark" ? "#1a1a1a" : "#ffffff"');
  border-radius: 6px;
  border: 2px solid transparent;
  transition: box-shadow 0.2s, border-color 0.2s;
}

/* Drag over visual feedback */
.terminal-wrapper.drag-over {
  border-color: #00d084;
  box-shadow: inset 0 0 20px rgba(0, 208, 132, 0.2);
}

/* Search bar */
.terminal-search-bar {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 8px;
  background-color: v-bind('props.theme === "dark" ? "#2d2d2d" : "#f0f0f0"');
  border-bottom: 1px solid v-bind('props.theme === "dark" ? "#404040" : "#d0d0d0"');
  border-radius: 6px 6px 0 0;
}

.search-input {
  flex: 1;
  min-width: 150px;
  max-width: 300px;
  padding: 4px 8px;
  border: 1px solid v-bind('props.theme === "dark" ? "#404040" : "#c0c0c0"');
  border-radius: 4px;
  background-color: v-bind('props.theme === "dark" ? "#1a1a1a" : "#ffffff"');
  color: v-bind('props.theme === "dark" ? "#c0c0c0" : "#333333"');
  font-size: 13px;
  outline: none;
}

.search-input:focus {
  border-color: #00d084;
}

.search-input::placeholder {
  color: v-bind('props.theme === "dark" ? "#666" : "#999"');
}

.search-count {
  font-size: 12px;
  color: v-bind('props.theme === "dark" ? "#888" : "#666"');
  min-width: 50px;
  text-align: center;
}

.search-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: none;
  border-radius: 4px;
  background-color: transparent;
  color: v-bind('props.theme === "dark" ? "#c0c0c0" : "#333333"');
  cursor: pointer;
  transition: background-color 0.15s;
}

.search-btn:hover {
  background-color: v-bind('props.theme === "dark" ? "#404040" : "#d0d0d0"');
}

.search-btn:active {
  background-color: v-bind('props.theme === "dark" ? "#505050" : "#c0c0c0"');
}

.terminal-container {
  flex: 1;
  min-height: 0;
  padding: 0 8px 12px 8px;
  box-sizing: border-box;
}

.terminal-container :deep(.xterm) {
  height: 100%;
}

.terminal-container :deep(.xterm-viewport) {
  overflow-y: auto;
  padding-bottom: 40px;
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
