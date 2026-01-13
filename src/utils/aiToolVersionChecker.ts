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

import type { AIToolType } from '../stores/aiTools';

/**
 * NPM package information for AI tools
 */
interface NpmPackageInfo {
  packageName: string;
  versionCommand?: string; // Command to check installed version
}

/**
 * Mapping of AI tools to their NPM package names
 */
const NPM_PACKAGE_MAP: Record<AIToolType, NpmPackageInfo | null> = {
  'claude-code': {
    packageName: '@anthropic-ai/claude-code',
  },
  'codex': {
    packageName: '@openai/codex',
  },
  'gemini-cli': {
    packageName: '@google/gemini-cli',
  },
  'opencode': {
    packageName: 'opencode-ai',
  },
  'codebuddy': {
    packageName: '@tencent-ai/codebuddy-code',
  },
  'qoder-cli': {
    packageName: '@qoder-ai/qodercli',
  },
  'copilot-cli': null, // Cannot detect version, always show update button
  'droid': null, // Installed via script, not npm
  'augment-cli': {
    packageName: '@augmentcode/auggie',
  },
  'cursor-cli': null, // Installed via script, not npm
  'crush': {
    packageName: '@charmland/crush',
  },
  'ampcode': null, // Installed via script, not npm
};

/**
 * Get latest version from NPM registry
 * @param packageName - NPM package name
 * @returns Latest version string or null if failed
 */
export async function getLatestVersionFromNpm(packageName: string): Promise<string | null> {
  try {
    const response = await fetch(`https://registry.npmjs.org/${packageName}/latest`, {
      // Add timeout to prevent infinite waiting
      signal: AbortSignal.timeout(10000), // 10 seconds timeout
    });
    
    if (!response.ok) {
      console.warn(`Failed to fetch latest version for ${packageName}: ${response.statusText}`);
      return null;
    }
    
    const data = await response.json();
    return data.version || null;
  } catch (error) {
    console.error(`Error fetching latest version for ${packageName}:`, error);
    return null;
  }
}

/**
 * Get latest version for an AI tool
 * @param toolType - AI tool type
 * @returns Latest version string or null if not available
 */
export async function getLatestVersion(toolType: AIToolType): Promise<string | null> {
  const packageInfo = NPM_PACKAGE_MAP[toolType];
  
  if (!packageInfo) {
    // Tools not installed via npm (droid, cursor-cli) don't have version checking
    return null;
  }
  
  return await getLatestVersionFromNpm(packageInfo.packageName);
}

/**
 * Compare two version strings
 * @param current - Current version
 * @param latest - Latest version
 * @returns true if latest is newer than current
 */
export function isVersionNewer(current: string, latest: string): boolean {
  // Normalize versions (remove 'v' prefix, handle date-based versions)
  const normalizeVersion = (v: string): string => {
    return v.replace(/^v/i, '').trim();
  };
  
  const currentNorm = normalizeVersion(current);
  const latestNorm = normalizeVersion(latest);
  
  // If versions are the same, return false
  if (currentNorm === latestNorm) {
    return false;
  }
  
  // Try semantic version comparison
  try {
    const currentParts = currentNorm.split('.').map(Number);
    const latestParts = latestNorm.split('.').map(Number);
    
    for (let i = 0; i < Math.max(currentParts.length, latestParts.length); i++) {
      const currentPart = currentParts[i] || 0;
      const latestPart = latestParts[i] || 0;
      
      if (latestPart > currentPart) {
        return true;
      } else if (latestPart < currentPart) {
        return false;
      }
    }
    
    // If all parts are equal, check for pre-release suffixes
    if (latestNorm.includes('-') && !currentNorm.includes('-')) {
      return false; // Latest is pre-release, current is stable
    }
    if (!latestNorm.includes('-') && currentNorm.includes('-')) {
      return true; // Latest is stable, current is pre-release
    }
    
    // If both have suffixes, compare lexicographically
    return latestNorm > currentNorm;
  } catch {
    // Fallback to string comparison if parsing fails
    return latestNorm > currentNorm;
  }
}

/**
 * Get update command for an AI tool
 * @param toolType - AI tool type
 * @returns Update command string or null if not available
 */
export function getUpdateCommand(toolType: AIToolType): string | null {
  const packageInfo = NPM_PACKAGE_MAP[toolType];
  
  if (!packageInfo) {
    // For tools not installed via npm, return specific update commands
    switch (toolType) {
      case 'codebuddy':
        return 'codebuddy update';
      case 'copilot-cli':
        return 'agent update';
      case 'cursor-cli':
        // Cursor CLI doesn't have a direct update command
        return null;
      case 'droid':
        // Droid doesn't have a direct update command
        return null;
      case 'ampcode':
        // AmpCode doesn't have a direct update command
        return null;
      default:
        return null;
    }
  }
  
  // For npm packages, use npm install with @latest tag
  return `npm install -g ${packageInfo.packageName}@latest`;
}
