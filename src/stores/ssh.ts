/**
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
 */

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { getAdapter, type BackendAdapter, isTauri } from '../adapters';
import { safeInvoke } from '../utils/programUtils';

// Adapter instance for persistence
let adapter: BackendAdapter | null = null;

// Initialize adapter
const initAdapter = async () => {
  if (!adapter) {
    try {
      adapter = await getAdapter();
    } catch (error) {
      console.warn('[SSH] Failed to initialize adapter:', error);
      return null;
    }
  }
  return adapter;
};

export interface SshAuthMethod {
  type: 'password' | 'privateKey';
  password?: string;
  key_path?: string;
  passphrase?: string;
}

export interface SshConfig {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  auth: SshAuthMethod;
  keepAliveInterval?: number;  // Keep-alive interval in seconds (default: 60)
  keepConnection?: boolean;     // Whether to keep connection open when no tasks (default: false)
}

export type SshConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'agent_ready';

export interface SshConnectionInfo {
  id: string;
  status: SshConnectionStatus;
  task_count: number;
  last_ping?: number;
}

/**
 * SSH Store
 * 
 * Manages SSH configurations and connection states
 */
export const useSshStore = defineStore('ssh', () => {
  // SSH configurations (loaded from storage)
  const configs = ref<SshConfig[]>([]);
  
  // Connection statuses (keyed by config ID) - use object instead of Map for better Vue reactivity
  const connectionStatuses = ref<Record<string, SshConnectionInfo>>({});
  
  // Initialization flag
  const initialized = ref(false);
  
  // Loading state
  const loading = ref(false);
  
  /**
   * Load SSH configs from storage
   */
  async function loadConfigs(): Promise<void> {
    try {
      const adapterInstance = await initAdapter();
      if (adapterInstance) {
        const saved = await adapterInstance.storage.get<SshConfig[]>('ssh_configs');
        if (saved && Array.isArray(saved)) {
          configs.value = saved;
          console.log('[SSH] Loaded configs:', saved.length);
        }
      }
    } catch (error) {
      console.error('[SSH] Failed to load configs:', error);
    }
  }
  
  /**
   * Save SSH configs to storage
   */
  async function saveConfigs(): Promise<void> {
    try {
      const adapterInstance = await initAdapter();
      if (adapterInstance) {
        await adapterInstance.storage.set('ssh_configs', configs.value);
        await adapterInstance.storage.save();
        console.log('[SSH] Saved configs:', configs.value.length);
      }
    } catch (error) {
      console.error('[SSH] Failed to save configs:', error);
    }
  }
  
  /**
   * Initialize - load saved configs
   */
  async function initialize(): Promise<void> {
    if (initialized.value) return;
    
    initialized.value = true;
    await loadConfigs();
    
    // Add test SSH config in development mode
    if (import.meta.env.DEV) {
      const testConfigId = 'ssh-dev-test-config';
      const existingTestConfig = configs.value.find(c => c.id === testConfigId);
      if (!existingTestConfig) {
        const testConfig: SshConfig = {
          id: testConfigId,
          name: '[DEV] SSH Test Container',
          host: '127.0.0.1',
          port: 2222,
          username: 'testuser',
          auth: {
            type: 'password',
            password: 'test123',
          },
          keepAliveInterval: 60,
          keepConnection: false,
        };
        configs.value.unshift(testConfig);
        console.log('[SSH] Added dev test config');
      }
    }
    
    if (isTauri()) {
      // Sync saved configs to backend (desktop only)
      for (const config of configs.value) {
        try {
          await safeInvoke('save_ssh_config', {
            config: {
              id: config.id,
              name: config.name,
              host: config.host,
              port: config.port,
              username: config.username,
              auth: config.auth,
              keep_alive_interval: config.keepAliveInterval || 60,
              keep_connection: config.keepConnection || false,
            },
          });
        } catch (error) {
          console.error(`[SSH] Failed to sync config ${config.id} to backend:`, error);
        }
      }

      // Refresh connection statuses
      await refreshConnectionStatuses();

      // Start periodic status refresh
      setInterval(() => {
        refreshConnectionStatuses();
      }, 5000);
    } else {
      // Server/mock mode: backend SSH management is not available.
      // Still initialize statuses so UI can render.
      const newStatuses: Record<string, SshConnectionInfo> = {};
      for (const config of configs.value) {
        newStatuses[config.id] = {
          id: config.id,
          status: 'disconnected',
          task_count: 0,
        };
      }
      connectionStatuses.value = newStatuses;
    }
  }
  
  /**
   * Refresh connection status for all configs
   */
  async function refreshConnectionStatuses(): Promise<void> {
    if (!isTauri()) return;

    const newStatuses: Record<string, SshConnectionInfo> = { ...connectionStatuses.value };
    for (const config of configs.value) {
      try {
        const status = await safeInvoke<SshConnectionInfo>('get_ssh_connection_status', { id: config.id });
        if (status) {
          newStatuses[config.id] = status;
        }
      } catch (error) {
        console.error(`[SSH] Failed to get status for ${config.id}:`, error);
      }
    }
    // Trigger Vue reactivity by assigning a new object
    connectionStatuses.value = newStatuses;
  }
  
  /**
   * Refresh connection status for a specific config
   */
  async function refreshConnectionStatus(configId: string): Promise<void> {
    if (!isTauri()) return;

    try {
      console.log(`[SSH] Refreshing status for ${configId}...`);
      const status = await safeInvoke<SshConnectionInfo>('get_ssh_connection_status', { id: configId });
      console.log(`[SSH] Got status for ${configId}:`, status);
      if (status) {
        // Create a new object to trigger Vue reactivity
        connectionStatuses.value = {
          ...connectionStatuses.value,
          [configId]: status
        };
        console.log(`[SSH] Updated connectionStatuses:`, connectionStatuses.value);
      }
    } catch (error) {
      console.error(`[SSH] Failed to get status for ${configId}:`, error);
    }
  }
  
  /**
   * Add a new SSH config
   */
  async function addConfig(config: Omit<SshConfig, 'id'>): Promise<SshConfig> {
    const id = `ssh-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newConfig: SshConfig = {
      ...config,
      id,
      keepAliveInterval: config.keepAliveInterval ?? 60,
      keepConnection: config.keepConnection ?? false,
    };
    
    configs.value.push(newConfig);
    await saveConfigs();
    
    // Save to backend (desktop only)
    if (isTauri()) {
      try {
        await safeInvoke('save_ssh_config', {
          config: {
            id: newConfig.id,
            name: newConfig.name,
            host: newConfig.host,
            port: newConfig.port,
            username: newConfig.username,
            auth: newConfig.auth,
            keep_alive_interval: newConfig.keepAliveInterval || 60,
            keep_connection: newConfig.keepConnection || false,
          },
        });
      } catch (error) {
        console.error('[SSH] Failed to save to backend:', error);
      }
    }
    
    return newConfig;
  }
  
  /**
   * Update an existing SSH config
   */
  async function updateConfig(id: string, updates: Partial<Omit<SshConfig, 'id'>>): Promise<void> {
    const index = configs.value.findIndex(c => c.id === id);
    if (index === -1) {
      throw new Error(`SSH config not found: ${id}`);
    }
    
    configs.value[index] = {
      ...configs.value[index],
      ...updates,
    };
    
    await saveConfigs();
    
    // Update in backend (desktop only)
    if (isTauri()) {
      try {
        await safeInvoke('save_ssh_config', {
          config: {
            id: configs.value[index].id,
            name: configs.value[index].name,
            host: configs.value[index].host,
            port: configs.value[index].port,
            username: configs.value[index].username,
            auth: configs.value[index].auth,
            keep_alive_interval: configs.value[index].keepAliveInterval || 60,
            keep_connection: configs.value[index].keepConnection || false,
          },
        });
      } catch (error) {
        console.error('[SSH] Failed to update in backend:', error);
      }

      await refreshConnectionStatus(id);
    }
  }
  
  /**
   * Delete an SSH config
   */
  async function deleteConfig(id: string): Promise<void> {
    const index = configs.value.findIndex(c => c.id === id);
    if (index === -1) {
      return;
    }
    
    configs.value.splice(index, 1);
    // Delete from connectionStatuses object
    const { [id]: _, ...rest } = connectionStatuses.value;
    connectionStatuses.value = rest;
    await saveConfigs();
    
    // Delete from backend (desktop only)
    if (isTauri()) {
      try {
        await safeInvoke('delete_ssh_config', { id });
      } catch (error) {
        console.error('[SSH] Failed to delete from backend:', error);
      }
    }
  }
  
  /**
   * Get SSH config by ID
   */
  function getConfig(id: string): SshConfig | undefined {
    return configs.value.find(c => c.id === id);
  }
  
  /**
   * Connect to SSH server
   */
  async function connect(id: string): Promise<void> {
    if (!isTauri()) {
      throw new Error('SSH connect is only available in desktop mode');
    }

    console.log(`[SSH] connect() called with id: ${id}`);
    loading.value = true;
    try {
      console.log(`[SSH] Calling connect_ssh...`);
      await safeInvoke('connect_ssh', { id });
      console.log(`[SSH] connect_ssh completed, refreshing status...`);
      await refreshConnectionStatus(id);
      console.log(`[SSH] Status refresh completed`);
    } catch (error) {
      console.error(`[SSH] Failed to connect ${id}:`, error);
      throw error;
    } finally {
      loading.value = false;
    }
  }
  
  /**
   * Disconnect from SSH server
   */
  async function disconnect(id: string): Promise<void> {
    if (!isTauri()) {
      throw new Error('SSH disconnect is only available in desktop mode');
    }

    loading.value = true;
    try {
      await safeInvoke('disconnect_ssh', { id });
      await refreshConnectionStatus(id);
    } catch (error) {
      console.error(`[SSH] Failed to disconnect ${id}:`, error);
      throw error;
    } finally {
      loading.value = false;
    }
  }
  
  /**
   * Test SSH connection
   */
  async function testConnection(config: SshConfig): Promise<string> {
    if (!isTauri()) {
      throw new Error('SSH connection test is only available in desktop mode');
    }

    try {
      const result = await safeInvoke<string>('test_ssh_connection', {
        config: {
          id: config.id,
          name: config.name,
          host: config.host,
          port: config.port,
          username: config.username,
          auth: config.auth,
          keep_alive_interval: config.keepAliveInterval,
          keep_connection: config.keepConnection,
        },
      });
      return result || 'Connection test successful';
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Connection test failed: ${errorMessage}`);
    }
  }
  
  /**
   * Test SSH agent (ping/pong)
   */
  async function testAgent(id: string): Promise<boolean> {
    if (!isTauri()) {
      return false;
    }

    try {
      const result = await safeInvoke<boolean>('test_ssh_agent', { id });
      await refreshConnectionStatus(id);
      return result || false;
    } catch (error) {
      console.error(`[SSH] Failed to test agent ${id}:`, error);
      return false;
    }
  }
  
  /**
   * Get connection status for a config
   */
  function getConnectionStatus(id: string): SshConnectionInfo | undefined {
    return connectionStatuses.value[id];
  }
  
  /**
   * Check if a config is connected
   */
  function isConnected(id: string): boolean {
    const status = connectionStatuses.value[id];
    return status?.status === 'connected' || status?.status === 'agent_ready';
  }
  
  /**
   * Check if agent is ready
   */
  function isAgentReady(id: string): boolean {
    const status = connectionStatuses.value[id];
    return status?.status === 'agent_ready';
  }
  
  // Computed: config options for select dropdowns
  const configOptions = computed(() => {
    return configs.value.map(config => ({
      label: config.name,
      value: config.id,
      host: config.host,
      port: config.port,
      username: config.username,
    }));
  });
  
  /**
   * Parse SSH config file content and extract host configurations
   */
  function parseSshConfigContent(content: string): Array<{
    host: string;
    hostname: string;
    port: number;
    user: string;
    identityFile?: string;
  }> {
    const hosts: Array<{
      host: string;
      hostname: string;
      port: number;
      user: string;
      identityFile?: string;
    }> = [];
    
    const lines = content.split('\n');
    let currentHost: {
      host: string;
      hostname: string;
      port: number;
      user: string;
      identityFile?: string;
    } | null = null;
    
    for (const line of lines) {
      const trimmed = line.trim();
      
      // Skip comments and empty lines
      if (trimmed.startsWith('#') || trimmed === '') {
        continue;
      }
      
      // Parse key-value pairs (supports both "Key Value" and "Key=Value" formats)
      const match = trimmed.match(/^(\S+)\s*[=\s]\s*(.+)$/);
      if (!match) continue;
      
      const [, key, value] = match;
      const keyLower = key.toLowerCase();
      
      if (keyLower === 'host') {
        // Save previous host if exists and has required fields
        if (currentHost && currentHost.hostname && currentHost.host !== '*') {
          hosts.push(currentHost);
        }
        
        // Start new host (skip wildcard patterns)
        if (value !== '*' && !value.includes('*') && !value.includes('?')) {
          currentHost = {
            host: value,
            hostname: '',
            port: 22,
            user: '',
          };
        } else {
          currentHost = null;
        }
      } else if (currentHost) {
        switch (keyLower) {
          case 'hostname':
            currentHost.hostname = value;
            break;
          case 'port':
            currentHost.port = parseInt(value, 10) || 22;
            break;
          case 'user':
            currentHost.user = value;
            break;
          case 'identityfile':
            // Expand ~ to home directory placeholder (will be handled later)
            currentHost.identityFile = value;
            break;
        }
      }
    }
    
    // Don't forget the last host
    if (currentHost && currentHost.hostname && currentHost.host !== '*') {
      hosts.push(currentHost);
    }
    
    return hosts;
  }
  
  /**
   * Import SSH configs from parsed SSH config file entries
   */
  async function importFromSshConfig(
    entries: Array<{
      host: string;
      hostname: string;
      port: number;
      user: string;
      identityFile?: string;
    }>,
    homeDir: string
  ): Promise<{ imported: number; skipped: number }> {
    let imported = 0;
    let skipped = 0;
    
    for (const entry of entries) {
      // Check if a config with same host/port/user already exists
      const exists = configs.value.some(
        c => c.host === entry.hostname && c.port === entry.port && c.username === entry.user
      );
      
      if (exists) {
        skipped++;
        continue;
      }
      
      // Expand ~ in identity file path
      let keyPath = entry.identityFile;
      if (keyPath) {
        keyPath = keyPath.replace(/^~/, homeDir);
      }
      
      const auth: SshAuthMethod = keyPath
        ? { type: 'privateKey', key_path: keyPath }
        : { type: 'password', password: '' };
      
      await addConfig({
        name: entry.host,
        host: entry.hostname,
        port: entry.port,
        username: entry.user || 'root',
        auth,
        keepAliveInterval: 60,
        keepConnection: false,
      });
      
      imported++;
    }
    
    return { imported, skipped };
  }
  
  /**
   * Remote directory entry type
   */
  interface RemoteDirectoryEntry {
    name: string;
    path: string;
    is_dir: boolean;
    size?: number;
  }
  
  /**
   * Remote shell info type
   */
  interface RemoteShellInfo {
    id: string;
    name: string;
    path: string;
    is_default: boolean;
  }
  
  /**
   * List remote directory contents via SSH
   */
  async function listDirectory(configId: string, path: string): Promise<RemoteDirectoryEntry[]> {
    if (!isTauri()) {
      throw new Error('Remote directory listing is only available in desktop mode');
    }

    try {
      const result = await safeInvoke<RemoteDirectoryEntry[]>('list_ssh_directory', {
        configId,
        path,
      });
      return result || [];
    } catch (error) {
      console.error(`[SSH] Failed to list directory ${path}:`, error);
      throw error;
    }
  }
  
  /**
   * Get user's home directory on remote server
   */
  async function getHomeDirectory(configId: string): Promise<string> {
    if (!isTauri()) {
      throw new Error('Remote home directory is only available in desktop mode');
    }

    try {
      const result = await safeInvoke<string>('get_ssh_home_directory', {
        configId,
      });
      return result || '/';
    } catch (error) {
      console.error(`[SSH] Failed to get home directory:`, error);
      throw error;
    }
  }
  
  /**
   * Get available shells on remote server
   */
  async function getRemoteShells(configId: string): Promise<RemoteShellInfo[]> {
    if (!isTauri()) {
      throw new Error('Remote shells are only available in desktop mode');
    }

    try {
      const result = await safeInvoke<RemoteShellInfo[]>('get_ssh_shells', {
        configId,
      });
      return result || [];
    } catch (error) {
      console.error(`[SSH] Failed to get remote shells:`, error);
      throw error;
    }
  }
  
  return {
    // State
    configs,
    connectionStatuses,
    initialized,
    loading,
    
    // Computed
    configOptions,
    
    // Methods
    initialize,
    loadConfigs,
    saveConfigs,
    refreshConnectionStatuses,
    refreshConnectionStatus,
    addConfig,
    updateConfig,
    deleteConfig,
    getConfig,
    connect,
    disconnect,
    testConnection,
    testAgent,
    getConnectionStatus,
    isConnected,
    isAgentReady,
    parseSshConfigContent,
    importFromSshConfig,
    // Remote directory/shell operations
    listDirectory,
    getHomeDirectory,
    getRemoteShells,
  };
});
