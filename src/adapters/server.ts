/**
 * Server Backend Adapter (Placeholder)
 * 
 * Implementation of BackendAdapter for remote server execution
 * This will connect to a backend server via WebSocket/HTTP
 */

import type { BackendAdapter } from './types';

// Import mock adapter as fallback
import { MockAdapter } from './mock';

/**
 * Server Backend Adapter
 * 
 * TODO: Implement WebSocket/HTTP connection to remote server
 * For now, extends MockAdapter as a placeholder
 */
export class ServerAdapter extends MockAdapter implements BackendAdapter {
  override readonly type: 'tauri' | 'server' | 'mock' = 'server';
  
  private serverUrl: string;
  private ws: WebSocket | null = null;
  
  constructor(serverUrl: string = 'ws://localhost:8080') {
    super();
    this.serverUrl = serverUrl;
  }
  
  override async init(): Promise<void> {
    await super.init();
    
    // TODO: Establish WebSocket connection
    // this.ws = new WebSocket(this.serverUrl);
    // await this.waitForConnection();
    
    console.log('[Server] Server adapter initialized (using mock fallback), url:', this.serverUrl);
  }
  
  override async dispose(): Promise<void> {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    await super.dispose();
  }
  
  // TODO: Override methods to use server communication
  // Example:
  // terminal = new ServerTerminalAdapter(this.ws);
  // fs = new ServerFileSystemAdapter(this.ws);
  // etc.
}

export function createServerAdapter(serverUrl?: string): BackendAdapter {
  return new ServerAdapter(serverUrl);
}
