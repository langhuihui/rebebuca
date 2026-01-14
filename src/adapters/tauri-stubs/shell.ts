/**
 * Tauri Shell Plugin Stub for Server/Mock mode
 * These are no-op implementations that prevent runtime errors
 */

export async function open(path: string, openWith?: string): Promise<void> {
  console.warn('[Tauri Stub] shell.open() called in non-Tauri environment:', path, openWith);
  // Try to open in browser
  window.open(path, '_blank');
}

export interface SpawnOptions {
  cwd?: string;
  env?: Record<string, string>;
  encoding?: string;
}

export interface ChildProcess {
  pid: number;
  kill(): Promise<void>;
  write(data: string | Uint8Array): Promise<void>;
}

export interface CommandEvent {
  event: 'stdout' | 'stderr' | 'error' | 'close';
  payload: string | number;
}

export class Command {
  program: string;
  args: string[];
  options: SpawnOptions;
  
  constructor(program: string, args?: string | string[], options?: SpawnOptions) {
    this.program = program;
    this.args = Array.isArray(args) ? args : args ? [args] : [];
    this.options = options || {};
  }
  
  static create(program: string, args?: string | string[], options?: SpawnOptions): Command {
    return new Command(program, args, options);
  }
  
  static sidecar(program: string, args?: string | string[], options?: SpawnOptions): Command {
    return new Command(program, args, options);
  }
  
  async spawn(): Promise<ChildProcess> {
    console.warn('[Tauri Stub] Command.spawn() called in non-Tauri environment');
    throw new Error('Command.spawn() not available in server mode');
  }
  
  async execute(): Promise<{ code: number; signal: string | null; stdout: string; stderr: string }> {
    console.warn('[Tauri Stub] Command.execute() called in non-Tauri environment');
    throw new Error('Command.execute() not available in server mode');
  }
  
  on(_event: string, _handler: (event: CommandEvent) => void): Command {
    console.warn('[Tauri Stub] Command.on() called in non-Tauri environment');
    return this;
  }
  
  stdout = {
    on: (_event: string, _handler: (line: string) => void) => {
      return this;
    }
  };
  
  stderr = {
    on: (_event: string, _handler: (line: string) => void) => {
      return this;
    }
  };
}
