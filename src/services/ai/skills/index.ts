/**
 * Rebebuca AI Service Layer - Skill Loader
 * Loads skill definitions from a directory
 */

import type { SkillDefinition } from '../agents/types';
import { getAdapter } from '../../../adapters';

/**
 * Parse YAML frontmatter from markdown content
 */
function parseFrontmatter(content: string): { frontmatter: Record<string, string>; body: string } {
  const frontmatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/;
  const match = content.match(frontmatterRegex);
  
  if (!match) {
    return { frontmatter: {}, body: content };
  }
  
  const frontmatterStr = match[1];
  const body = match[2];
  const frontmatter: Record<string, string> = {};
  
  // Simple YAML parsing for key: value pairs
  for (const line of frontmatterStr.split('\n')) {
    const colonIndex = line.indexOf(':');
    if (colonIndex > 0) {
      const key = line.slice(0, colonIndex).trim();
      const value = line.slice(colonIndex + 1).trim();
      frontmatter[key] = value;
    }
  }
  
  return { frontmatter, body };
}

/**
 * Load a single skill from a markdown file
 */
async function loadSkillFromFile(filePath: string): Promise<SkillDefinition | null> {
  try {
    const adapter = await getAdapter();
    const content = await adapter.fs.readTextFile(filePath);
    const { frontmatter, body } = parseFrontmatter(content);
    
    const name = frontmatter.name || filePath.split('/').pop()?.replace('.md', '') || 'unknown';
    const description = frontmatter.description || '';
    
    return {
      name,
      description,
      content: body.trim(),
      filePath,
    };
  } catch (error) {
    console.error(`[SkillLoader] Failed to load skill from ${filePath}:`, error);
    return null;
  }
}

/**
 * Load all skills from a directory (recursively searches for SKILL.md files)
 */
export async function loadSkillsFromDirectory(dirPath: string): Promise<SkillDefinition[]> {
  const skills: SkillDefinition[] = [];
  const adapter = await getAdapter();
  
  try {
    const entries = await adapter.fs.readDir(dirPath);
    
    for (const entry of entries) {
      const fullPath = `${dirPath}/${entry.name}`;
      
      if (entry.isDirectory) {
        // Check for SKILL.md in subdirectory
        const skillPath = `${fullPath}/SKILL.md`;
        try {
          const exists = await adapter.fs.exists(skillPath);
          if (exists) {
            const skill = await loadSkillFromFile(skillPath);
            if (skill) {
              skills.push(skill);
            }
          }
        } catch {
          // Ignore if file doesn't exist
        }
      } else if (entry.name.endsWith('.md') && entry.name !== 'README.md') {
        // Load standalone .md files as skills
        const skill = await loadSkillFromFile(fullPath);
        if (skill) {
          skills.push(skill);
        }
      }
    }
  } catch (error) {
    console.error(`[SkillLoader] Failed to read directory ${dirPath}:`, error);
  }
  
  console.log(`[SkillLoader] Loaded ${skills.length} skills from ${dirPath}`);
  return skills;
}

/**
 * Format skills into a prompt section for injection into system prompt
 */
export function formatSkillsForPrompt(skills: SkillDefinition[]): string {
  if (skills.length === 0) return '';
  
  const sections = skills.map(skill => {
    return `## Skill: ${skill.name}
${skill.description ? `> ${skill.description}\n` : ''}
${skill.content}`;
  });
  
  return `
# Available Skills

The following skills provide specialized knowledge and workflows. Use them when relevant to the task.

${sections.join('\n\n---\n\n')}
`;
}
