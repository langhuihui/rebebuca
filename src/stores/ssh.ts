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
import { getAdapter, type BackendAdapter } from '../adapters';
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
  
  // Connection statuses (keyed by config ID)
  const connectionStatuses = ref<Map<string, SshConnectionInfo>>(new Map());
  
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
    
    // Sync saved configs to backend
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
  }
  
  /**
   * Refresh connection status for all configs
   */
  async function refreshConnectionStatuses(): Promise<void> {
    for (const config of configs.value) {
      try {
        const status = await safeInvoke<SshConnectionInfo>('get_ssh_connection_status', { id: config.id });
        if (status) {
          connectionStatuses.value.set(config.id, status);
        }
      } catch (error) {
        console.error(`[SSH] Failed to get status for ${config.id}:`, error);
      }
    }
  }
  
  /**
   * Refresh connection status for a specific config
   */
  async function refreshConnectionStatus(configId: string): Promise<void> {
    try {
      const status = await safeInvoke<SshConnectionInfo>('get_ssh_connection_status', { id: configId });
      if (status) {
        connectionStatuses.value.set(configId, status);
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
    
    // Save to backend
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
    
    // Update in backend
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
  
  /**
   * Delete an SSH config
   */
  async function deleteConfig(id: string): Promise<void> {
    const index = configs.value.findIndex(c => c.id === id);
    if (index === -1) {
      return;
    }
    
    configs.value.splice(index, 1);
    connectionStatuses.value.delete(id);
    await saveConfigs();
    
    // Delete from backend
    try {
      await safeInvoke('delete_ssh_config', { id });
    } catch (error) {
      console.error('[SSH] Failed to delete from backend:', error);
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
    loading.value = true;
    try {
      await safeInvoke('connect_ssh', { id });
      await refreshConnectionStatus(id);
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
    return connectionStatuses.value.get(id);
  }
  
  /**
   * Check if a config is connected
   */
  function isConnected(id: string): boolean {
    const status = connectionStatuses.value.get(id);
    return status?.status === 'connected' || status?.status === 'agent_ready';
  }
  
  /**
   * Check if agent is ready
   */
  function isAgentReady(id: string): boolean {
    const status = connectionStatuses.value.get(id);
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
  };
});
