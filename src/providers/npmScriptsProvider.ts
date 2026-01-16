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

import { getAdapter, isTauri, type FileSystemAdapter } from '../adapters';
import { 
  TaskProvider, 
  Task, 
  ScanResult, 
  TaskGroup,
  TaskType,
  PackageJson,
} from './types';

// Path utilities that work in both Tauri and server modes
async function pathJoin(...parts: string[]): Promise<string> {
  if (isTauri()) {
    const { join } = await import('@tauri-apps/api/path');
    return join(...parts);
  }
  // Simple join for server mode
  return parts.filter(Boolean).join('/').replace(/\/+/g, '/');
}

async function pathBasename(path: string): Promise<string> {
  if (isTauri()) {
    const { basename } = await import('@tauri-apps/api/path');
    return basename(path);
  }
  // Simple basename for server mode
  const parts = path.replace(/\\/g, '/').split('/');
  return parts[parts.length - 1] || '';
}

/**
 * Provider for npm scripts from package.json files
 * 
 * Scans for package.json files and extracts scripts section
 */
export class NpmScriptsProvider implements TaskProvider {
  readonly id = 'npm-scripts';
  readonly name = 'npm Scripts';
  readonly source = 'npm' as const;
  readonly icon = 'npm';
  
  private fsAdapter: FileSystemAdapter | null = null;
  
  /**
   * Get file system adapter
   */
  private async getFs(): Promise<FileSystemAdapter> {
    if (!this.fsAdapter) {
      const adapter = await getAdapter();
      this.fsAdapter = adapter.fs;
    }
    return this.fsAdapter;
  }
  
  /**
   * Scan a folder for package.json files
   */
  async scan(folderPath: string, recursive = false): Promise<ScanResult[]> {
    const results: ScanResult[] = [];
    
    if (recursive) {
      // Recursively scan for package.json files
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
   * Scan a single folder for package.json
   */
  private async scanFolder(folderPath: string): Promise<ScanResult | null> {
    try {
      const fs = await this.getFs();
      const packageJsonPath = await pathJoin(folderPath, 'package.json');
      console.log(`[NpmScriptsProvider] Checking: ${packageJsonPath}`);
      
      const exists = await fs.exists(packageJsonPath);
      console.log(`[NpmScriptsProvider] Exists: ${exists}`);
      
      if (exists) {
        const content = await fs.readTextFile(packageJsonPath);
        console.log(`[NpmScriptsProvider] Read content, length: ${content.length}`);
        const tasks = await this.parsePackageJson(content, folderPath, packageJsonPath);
        console.log(`[NpmScriptsProvider] Parsed ${tasks.length} tasks`);
        
        return {
          path: folderPath,
          tasks,
          sourceFile: packageJsonPath,
        };
      }
    } catch (error) {
      console.warn(`[NpmScriptsProvider] Error scanning ${folderPath}:`, error);
      return {
        path: folderPath,
        tasks: [],
        errors: [String(error)],
      };
    }
    
    return null;
  }
  
  /**
   * Recursively scan directories for package.json files
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
    if (result && (result.tasks.length > 0 || (result.errors && result.errors.length > 0))) {
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
      const fs = await this.getFs();
      const entries = await fs.readDir(folderPath);
      
      for (const entry of entries) {
        if (entry.isDirectory && entry.name && !skipDirs.has(entry.name) && !entry.name.startsWith('.')) {
          const subPath = await pathJoin(folderPath, entry.name);
          await this.scanRecursive(subPath, results, depth + 1, maxDepth);
        }
      }
    } catch (error) {
      // Ignore errors reading directories (permission issues, etc.)
      console.debug(`[NpmScriptsProvider] Could not read directory ${folderPath}:`, error);
    }
  }
  
  /**
   * Parse package.json content into Task objects
   */
  private async parsePackageJson(
    content: string, 
    folderPath: string, 
    sourceFile: string
  ): Promise<Task[]> {
    try {
      const packageJson = JSON.parse(content) as PackageJson;
      
      if (!packageJson.scripts || typeof packageJson.scripts !== 'object') {
        return [];
      }
      
      const tasks: Task[] = [];
      const folderName = await pathBasename(folderPath);
      const packageName = packageJson.name || folderName;
      
      for (const [scriptName, scriptCommand] of Object.entries(packageJson.scripts)) {
        if (typeof scriptCommand !== 'string') continue;
        
        const task = this.createTaskFromScript(
          scriptName,
          scriptCommand,
          packageName,
          folderPath,
          sourceFile
        );
        
        tasks.push(task);
      }
      
      return tasks;
    } catch (error) {
      console.error(`[NpmScriptsProvider] Error parsing package.json:`, error);
      return [];
    }
  }
  
  /**
   * Create a Task object from a script
   */
  private createTaskFromScript(
    scriptName: string,
    scriptCommand: string,
    packageName: string,
    folderPath: string,
    sourceFile: string
  ): Task {
    // Determine group based on script name
    const group = this.inferGroup(scriptName);
    
    // Determine if this is a default task
    const isDefault = scriptName === 'build' || scriptName === 'test';
    
    return {
      id: `npm:${packageName}:${scriptName}`,
      name: scriptName,
      source: 'npm',
      sourceFile,
      group,
      command: 'npm',
      args: ['run', scriptName],
      cwd: folderPath,
      type: TaskType.NPM,
      definition: {
        script: scriptName,
        command: scriptCommand,
        packageName,
      },
      isDefault,
    };
  }
  
  /**
   * Infer task group from script name
   */
  private inferGroup(scriptName: string): TaskGroup {
    const lowerName = scriptName.toLowerCase();
    
    // Build related
    if (lowerName === 'build' || 
        lowerName.startsWith('build:') || 
        lowerName.includes('compile') ||
        lowerName.includes('bundle')) {
      return 'build';
    }
    
    // Test related
    if (lowerName === 'test' || 
        lowerName.startsWith('test:') ||
        lowerName.includes('spec') ||
        lowerName === 'e2e' ||
        lowerName.startsWith('e2e:')) {
      return 'test';
    }
    
    // Clean related
    if (lowerName === 'clean' || 
        lowerName.startsWith('clean:') ||
        lowerName.includes('clear')) {
      return 'clean';
    }
    
    return 'none';
  }
  
  /**
   * Check if a file change should trigger a rescan
   */
  shouldRescan(filePath: string): boolean {
    return filePath.endsWith('package.json');
  }
}

// Export singleton instance
export const npmScriptsProvider = new NpmScriptsProvider();
