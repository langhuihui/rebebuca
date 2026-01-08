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

import { 
  readDir,
  exists as fsExists,
} from '@tauri-apps/plugin-fs';
import { join, basename } from '@tauri-apps/api/path';
import { platform } from '@tauri-apps/plugin-os';
import { 
  TaskProvider, 
  Task, 
  ScanResult, 
  TaskGroup,
} from './types';

/**
 * Script file extensions to scan for
 */
const SCRIPT_EXTENSIONS = {
  windows: ['.bat', '.cmd', '.ps1'],
  unix: ['.sh', '.bash', '.zsh', '.fish'],
  python: ['.py'],
  other: ['.rb', '.pl', '.js', '.ts'],
};

/**
 * Provider for executable script files
 * 
 * Scans for script files (.sh, .bat, .ps1, .py, etc.) and makes them executable as tasks
 */
export class ScriptsProvider implements TaskProvider {
  readonly id = 'scripts';
  readonly name = 'Script Files';
  readonly source = 'script' as const;
  readonly icon = 'script';
  
  private currentPlatform: string | null = null;
  
  /**
   * Get current platform
   */
  private async getPlatform(): Promise<string> {
    if (!this.currentPlatform) {
      const os = await platform();
      if (os === 'windows') {
        this.currentPlatform = 'windows';
      } else if (os === 'linux') {
        this.currentPlatform = 'linux';
      } else {
        this.currentPlatform = 'osx';
      }
    }
    return this.currentPlatform;
  }
  
  /**
   * Get relevant script extensions for current platform
   */
  private async getRelevantExtensions(): Promise<string[]> {
    const platformType = await this.getPlatform();
    const extensions: string[] = [];
    
    if (platformType === 'windows') {
      extensions.push(...SCRIPT_EXTENSIONS.windows);
    } else {
      extensions.push(...SCRIPT_EXTENSIONS.unix);
    }
    
    // Add Python and other cross-platform scripts
    extensions.push(...SCRIPT_EXTENSIONS.python);
    extensions.push(...SCRIPT_EXTENSIONS.other);
    
    return extensions;
  }
  
  /**
   * Check if a file is a script file based on extension
   */
  private async isScriptFile(filename: string): Promise<boolean> {
    const extensions = await this.getRelevantExtensions();
    return extensions.some(ext => filename.toLowerCase().endsWith(ext));
  }
  
  /**
   * Scan a folder for script files
   */
  async scan(folderPath: string, recursive = false): Promise<ScanResult[]> {
    const results: ScanResult[] = [];
    
    if (recursive) {
      // Recursively scan for script files
      await this.scanRecursive(folderPath, results, 0, 5); // Max depth of 5
    } else {
      // Just check the immediate folder
      const result = await this.scanFolder(folderPath);
      if (result) {
        results.push(result);
      }
    }
    
    return results;
  }
  
  /**
   * Scan a single folder for script files
   */
  private async scanFolder(folderPath: string): Promise<ScanResult | null> {
    try {
      console.log(`[ScriptsProvider] Scanning: ${folderPath}`);
      
      const exists = await fsExists(folderPath);
      if (!exists) {
        return null;
      }
      
      const entries = await readDir(folderPath);
      const tasks: Task[] = [];
      
      for (const entry of entries) {
        if (!entry.isDirectory && entry.name) {
          const isScript = await this.isScriptFile(entry.name);
          if (isScript) {
            const scriptPath = await join(folderPath, entry.name);
            const task = await this.createTaskFromScript(entry.name, scriptPath, folderPath);
            if (task) {
              tasks.push(task);
            }
          }
        }
      }
      
      if (tasks.length > 0) {
        console.log(`[ScriptsProvider] Found ${tasks.length} script files in ${folderPath}`);
        return {
          path: folderPath,
          tasks,
          sourceFile: folderPath,
        };
      }
    } catch (error) {
      console.warn(`[ScriptsProvider] Error scanning ${folderPath}:`, error);
      return {
        path: folderPath,
        tasks: [],
        errors: [String(error)],
      };
    }
    
    return null;
  }
  
  /**
   * Recursively scan directories for script files
   */
  private async scanRecursive(
    folderPath: string, 
    results: ScanResult[], 
    depth: number,
    maxDepth: number
  ): Promise<void> {
    if (depth > maxDepth) return;
    
    // Check current folder
    const result = await this.scanFolder(folderPath);
    if (result && result.tasks.length > 0) {
      results.push(result);
    }
    
    // Skip common non-project directories
    const skipDirs = new Set([
      'node_modules',
      '.git',
      '.svn',
      'dist',
      'build',
      'out',
      '.next',
      '.nuxt',
      'target',
      'vendor',
      '__pycache__',
      '.venv',
      'venv',
    ]);
    
    try {
      const entries = await readDir(folderPath);
      
      for (const entry of entries) {
        if (entry.isDirectory && entry.name && !skipDirs.has(entry.name) && !entry.name.startsWith('.')) {
          const subPath = await join(folderPath, entry.name);
          await this.scanRecursive(subPath, results, depth + 1, maxDepth);
        }
      }
    } catch (error) {
      // Ignore errors reading directories (permission issues, etc.)
      console.debug(`[ScriptsProvider] Could not read directory ${folderPath}:`, error);
    }
  }
  
  /**
   * Create a Task object from a script file
   */
  private async createTaskFromScript(
    filename: string,
    scriptPath: string,
    folderPath: string
  ): Promise<Task | null> {
    try {
      const platformType = await this.getPlatform();
      const extension = filename.substring(filename.lastIndexOf('.')).toLowerCase();
      const nameWithoutExt = filename.substring(0, filename.lastIndexOf('.'));
      const folderName = await basename(folderPath);
      
      // Determine command based on file extension
      let command: string;
      let args: string[];
      
      // Windows scripts
      if (extension === '.bat' || extension === '.cmd') {
        command = scriptPath;
        args = [];
      } 
      // PowerShell scripts
      else if (extension === '.ps1') {
        command = 'powershell';
        args = ['-ExecutionPolicy', 'Bypass', '-File', scriptPath];
      }
      // Unix shell scripts
      else if (['.sh', '.bash', '.zsh', '.fish'].includes(extension)) {
        // On Windows, we might use bash from Git or WSL
        if (platformType === 'windows') {
          command = 'bash';
          args = [scriptPath];
        } else {
          // On Unix, make the script executable (we assume it has shebang)
          command = scriptPath;
          args = [];
        }
      }
      // Python scripts
      else if (extension === '.py') {
        command = 'python';
        args = [scriptPath];
      }
      // Ruby scripts
      else if (extension === '.rb') {
        command = 'ruby';
        args = [scriptPath];
      }
      // Perl scripts
      else if (extension === '.pl') {
        command = 'perl';
        args = [scriptPath];
      }
      // JavaScript/TypeScript scripts (using Node.js)
      else if (extension === '.js') {
        command = 'node';
        args = [scriptPath];
      }
      else if (extension === '.ts') {
        // Try ts-node if available, otherwise use node
        command = 'ts-node';
        args = [scriptPath];
      }
      else {
        // Unknown script type
        return null;
      }
      
      // Determine group based on script name
      const group = this.inferGroup(nameWithoutExt);
      
      return {
        id: `script:${folderName}:${filename}`,
        name: filename,
        source: 'script',
        sourceFile: scriptPath,
        group,
        command,
        args,
        cwd: folderPath,
        type: 'shell',
        definition: {
          scriptPath,
          extension,
        },
        isDefault: false,
      };
    } catch (error) {
      console.error(`[ScriptsProvider] Error creating task from script ${filename}:`, error);
      return null;
    }
  }
  
  /**
   * Infer task group from script name
   */
  private inferGroup(scriptName: string): TaskGroup {
    const lowerName = scriptName.toLowerCase();
    
    // Build related
    if (lowerName.includes('build') || 
        lowerName.includes('compile') ||
        lowerName.includes('bundle') ||
        lowerName.includes('make')) {
      return 'build';
    }
    
    // Test related
    if (lowerName.includes('test') ||
        lowerName.includes('spec') ||
        lowerName.includes('e2e')) {
      return 'test';
    }
    
    // Clean related
    if (lowerName.includes('clean') || 
        lowerName.includes('clear') ||
        lowerName.includes('remove')) {
      return 'clean';
    }
    
    return 'none';
  }
  
  /**
   * Check if a file change should trigger a rescan
   */
  shouldRescan(filePath: string): boolean {
    // Check if file has a script extension
    const extensions = [
      ...SCRIPT_EXTENSIONS.windows,
      ...SCRIPT_EXTENSIONS.unix,
      ...SCRIPT_EXTENSIONS.python,
      ...SCRIPT_EXTENSIONS.other,
    ];
    
    return extensions.some(ext => filePath.toLowerCase().endsWith(ext));
  }
}

// Export singleton instance
export const scriptsProvider = new ScriptsProvider();
