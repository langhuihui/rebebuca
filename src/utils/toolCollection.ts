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

import type { BaseTool, ToolResult } from '../types/baseTool';

/**
 * Collection of tools for managing multiple tools
 * Inspired by OpenManus ToolCollection architecture
 */
export class ToolCollection {
  private tools: BaseTool[];
  private toolMap: Map<string, BaseTool>;

  constructor(...tools: BaseTool[]) {
    this.tools = tools;
    this.toolMap = new Map(tools.map(tool => [tool.name, tool]));
  }

  /**
   * Get all tools in the collection
   */
  getTools(): BaseTool[] {
    return [...this.tools];
  }

  /**
   * Get tool by name
   */
  getTool(name: string): BaseTool | undefined {
    return this.toolMap.get(name);
  }

  /**
   * Add a tool to the collection
   * Returns the collection for method chaining
   */
  addTool(tool: BaseTool): ToolCollection {
    if (this.toolMap.has(tool.name)) {
      const existingTool = this.toolMap.get(tool.name)!;
      console.warn(
        `[ToolCollection] Tool '${tool.name}' already exists in collection (existing: ${existingTool.description}), skipping new tool (${tool.description})`
      );
      return this;
    }

    this.tools.push(tool);
    this.toolMap.set(tool.name, tool);
    console.log(`[ToolCollection] Added tool: ${tool.name}`);
    return this;
  }

  /**
   * Add multiple tools to the collection
   * Returns the collection for method chaining
   */
  addTools(...tools: BaseTool[]): ToolCollection {
    for (const tool of tools) {
      this.addTool(tool);
    }
    return this;
  }

  /**
   * Remove a tool from the collection
   */
  removeTool(name: string): boolean {
    const tool = this.toolMap.get(name);
    if (!tool) {
      return false;
    }

    this.tools = this.tools.filter(t => t.name !== name);
    this.toolMap.delete(name);
    console.log(`[ToolCollection] Removed tool: ${name}`);
    return true;
  }

  /**
   * Execute a tool by name with given parameters
   */
  async execute(name: string, kwargs: Record<string, any> = {}): Promise<ToolResult> {
    const tool = this.toolMap.get(name);
    if (!tool) {
      return {
        error: `Tool ${name} is invalid or not found in collection`
      };
    }

    try {
      const result = await tool.execute(kwargs);
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        error: `Tool execution failed: ${errorMessage}`
      };
    }
  }

  /**
   * Execute all tools in the collection sequentially
   */
  async executeAll(): Promise<ToolResult[]> {
    const results: ToolResult[] = [];
    for (const tool of this.tools) {
      try {
        const result = await tool.execute({});
        results.push(result);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        results.push({
          error: `Tool ${tool.name} execution failed: ${errorMessage}`
        });
      }
    }
    return results;
  }

  /**
   * Convert all tools to function call parameters
   */
  toParams(): Array<ReturnType<BaseTool['toParam']>> {
    return this.tools.map(tool => tool.toParam());
  }

  /**
   * Get the number of tools in the collection
   */
  get size(): number {
    return this.tools.length;
  }

  /**
   * Check if a tool exists in the collection
   */
  hasTool(name: string): boolean {
    return this.toolMap.has(name);
  }

  /**
   * Clear all tools from the collection
   */
  clear(): void {
    this.tools = [];
    this.toolMap.clear();
    console.log('[ToolCollection] Cleared all tools');
  }

  /**
   * Iterator support for for...of loops
   */
  [Symbol.iterator](): Iterator<BaseTool> {
    return this.tools[Symbol.iterator]();
  }
}
