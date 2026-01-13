/**
 * Debug API Service
 * 
 * Provides APIs to retrieve frontend logs, Tauri logs, and DOM tree information
 */

import { getLogEntries, type LogEntry } from '../utils/devLogger';
import { invoke } from '@tauri-apps/api/core';

export interface DebugApiResponse {
  success: boolean;
  data: any;
  error?: string;
}

export interface DomNodeInfo {
  tagName: string;
  id?: string;
  className?: string;
  textContent?: string;
  attributes?: Record<string, string>;
  children?: DomNodeInfo[];
  nodeType: number;
}

/**
 * Get frontend logs (since app startup)
 */
export async function getFrontendLogs(): Promise<LogEntry[]> {
  return getLogEntries();
}

/**
 * Get Tauri logs (from current session)
 */
export async function getTauriLogs(): Promise<DebugApiResponse> {
  try {
    const response = await invoke<DebugApiResponse>('get_tauri_logs');
    return response;
  } catch (error) {
    return {
      success: false,
      data: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Extract DOM tree information
 * @param maxDepth Maximum depth to traverse (default: 10)
 * @param maxChildren Maximum children per node to include (default: 50)
 */
export function getDomTree(maxDepth: number = 10, maxChildren: number = 50): DomNodeInfo {
  const root = document.documentElement;
  
  function extractNodeInfo(node: Node, depth: number = 0): DomNodeInfo | null {
    if (depth > maxDepth) {
      return null;
    }
    
    const nodeInfo: DomNodeInfo = {
      tagName: node.nodeName.toLowerCase(),
      nodeType: node.nodeType,
    };
    
    // Extract element-specific information
    if (node.nodeType === Node.ELEMENT_NODE) {
      const element = node as Element;
      
      if (element.id) {
        nodeInfo.id = element.id;
      }
      
      if (element.className && typeof element.className === 'string') {
        nodeInfo.className = element.className;
      }
      
      // Extract attributes (limit to important ones)
      const importantAttrs = ['id', 'class', 'data-testid', 'role', 'aria-label', 'type', 'name', 'href', 'src'];
      const attributes: Record<string, string> = {};
      for (const attr of importantAttrs) {
        const value = element.getAttribute(attr);
        if (value) {
          attributes[attr] = value;
        }
      }
      if (Object.keys(attributes).length > 0) {
        nodeInfo.attributes = attributes;
      }
      
      // Extract text content (only if it's a leaf node or has significant text)
      const text = element.textContent?.trim();
      if (text && text.length > 0 && text.length < 200) {
        // Only include short text content to avoid huge payloads
        nodeInfo.textContent = text;
      }
    } else if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent?.trim();
      if (text && text.length > 0 && text.length < 200) {
        nodeInfo.textContent = text;
      } else {
        return null; // Skip long text nodes
      }
    }
    
    // Extract children (limited)
    if (node.childNodes.length > 0 && depth < maxDepth) {
      const children: DomNodeInfo[] = [];
      const childArray = Array.from(node.childNodes);
      const childrenToProcess = Math.min(childArray.length, maxChildren);
      
      for (let i = 0; i < childrenToProcess; i++) {
        const childInfo = extractNodeInfo(childArray[i], depth + 1);
        if (childInfo) {
          children.push(childInfo);
        }
      }
      
      if (children.length > 0) {
        nodeInfo.children = children;
      }
      
      // If there are more children, indicate truncation
      if (childArray.length > maxChildren) {
        nodeInfo.attributes = {
          ...(nodeInfo.attributes || {}),
          '_truncated_children': String(childArray.length - maxChildren),
        };
      }
    }
    
    return nodeInfo;
  }
  
  const tree = extractNodeInfo(root);
  return tree || {
    tagName: 'html',
    nodeType: Node.ELEMENT_NODE,
  };
}

/**
 * Get DOM tree and send to Tauri backend
 */
export async function getDomTreeInfo(maxDepth: number = 10, maxChildren: number = 50): Promise<DebugApiResponse> {
  try {
    const domTree = getDomTree(maxDepth, maxChildren);
    const response = await invoke<DebugApiResponse>('get_dom_tree', {
      domInfo: domTree,
    });
    return response;
  } catch (error) {
    return {
      success: false,
      data: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Get all debug information (frontend logs, Tauri logs, DOM tree)
 */
export async function getAllDebugInfo(
  maxDepth: number = 10,
  maxChildren: number = 50
): Promise<DebugApiResponse> {
  try {
    // Get frontend logs
    const frontendLogs = getFrontendLogs();
    
    // Get DOM tree
    const domTree = getDomTree(maxDepth, maxChildren);
    
    // Convert frontend logs to JSON-serializable format
    const frontendLogsJson = frontendLogs.map(log => ({
      timestamp: log.timestamp.toISOString(),
      level: log.level,
      source: log.source,
      message: log.message,
      data: log.data,
    }));
    
    // Get all debug info via Tauri command
    const response = await invoke<DebugApiResponse>('get_all_debug_info', {
      frontendLogs: frontendLogsJson,
      domInfo: domTree,
    });
    
    return response;
  } catch (error) {
    return {
      success: false,
      data: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Send frontend logs to Tauri backend
 */
export async function sendFrontendLogs(): Promise<DebugApiResponse> {
  try {
    const logs = getFrontendLogs();
    const logsJson = logs.map(log => ({
      timestamp: log.timestamp.toISOString(),
      level: log.level,
      source: log.source,
      message: log.message,
      data: log.data,
    }));
    
    const response = await invoke<DebugApiResponse>('get_frontend_logs', {
      logs: logsJson,
    });
    
    return response;
  } catch (error) {
    return {
      success: false,
      data: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Update MCP server cache with current frontend logs
 */
export async function updateMCPFrontendLogs(): Promise<void> {
  try {
    const logs = getLogEntries();
    const logsJson = logs.map(log => ({
      timestamp: log.timestamp.toISOString(),
      level: log.level,
      source: log.source,
      message: log.message,
      data: log.data,
    }));
    
    await invoke('mcp_update_frontend_logs', { logs: logsJson });
  } catch (error) {
    // Silently ignore - MCP server might not be running
    console.debug('[MCP] Failed to update frontend logs:', error);
  }
}

/**
 * Update MCP server cache with current DOM tree
 */
export async function updateMCPDomTree(maxDepth: number = 10, maxChildren: number = 50): Promise<void> {
  try {
    const domTree = getDomTree(maxDepth, maxChildren);
    await invoke('mcp_update_dom_tree', { domInfo: domTree });
  } catch (error) {
    // Silently ignore - MCP server might not be running
    console.debug('[MCP] Failed to update DOM tree:', error);
  }
}

// MCP cache update interval handle
let mcpUpdateIntervalId: number | null = null;

/**
 * Start periodic MCP cache updates
 * This keeps the MCP server in sync with the latest frontend state
 * @param intervalMs Update interval in milliseconds (default: 5000ms)
 */
export function startMCPCacheUpdates(intervalMs: number = 5000): void {
  // Don't start if already running
  if (mcpUpdateIntervalId !== null) {
    return;
  }
  
  // Initial update
  updateMCPFrontendLogs();
  updateMCPDomTree();
  
  // Set up periodic updates
  mcpUpdateIntervalId = window.setInterval(() => {
    updateMCPFrontendLogs();
    updateMCPDomTree();
  }, intervalMs);
  
  console.debug('[MCP] Cache updates started with interval:', intervalMs, 'ms');
}

/**
 * Stop periodic MCP cache updates
 */
export function stopMCPCacheUpdates(): void {
  if (mcpUpdateIntervalId !== null) {
    window.clearInterval(mcpUpdateIntervalId);
    mcpUpdateIntervalId = null;
    console.debug('[MCP] Cache updates stopped');
  }
}
