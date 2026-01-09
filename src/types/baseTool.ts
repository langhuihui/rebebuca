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

/**
 * Base tool interface for unified tool abstraction
 * Inspired by OpenManus tool architecture
 */

/**
 * Tool result containing the output, error, and optional metadata
 */
export interface ToolResult {
  output?: string;
  error?: string;
  base64_image?: string;
  system?: string;
}

/**
 * Tool parameter schema following JSON Schema format
 */
export interface ToolParameterSchema {
  type: string;
  properties?: Record<string, any>;
  required?: string[];
  additionalProperties?: boolean;
  description?: string;
  items?: any;
  enum?: any[];
  [key: string]: any;
}

/**
 * Base tool interface that all tools must implement
 */
export interface BaseTool {
  /**
   * Unique name of the tool
   */
  name: string;

  /**
   * Human-readable description of what the tool does
   */
  description: string;

  /**
   * JSON Schema describing the tool's parameters
   */
  parameters?: ToolParameterSchema;

  /**
   * Execute the tool with given parameters
   * @param kwargs - Tool-specific parameters
   * @returns Promise resolving to a ToolResult
   */
  execute(kwargs: Record<string, any>): Promise<ToolResult>;

  /**
   * Convert tool to function call format (OpenAI-compatible)
   */
  toParam(): {
    type: 'function';
    function: {
      name: string;
      description: string;
      parameters?: ToolParameterSchema;
    };
  };
}

/**
 * Abstract base class for tools
 */
export abstract class BaseToolClass implements BaseTool {
  constructor(
    public name: string,
    public description: string,
    public parameters?: ToolParameterSchema
  ) {}

  abstract execute(kwargs: Record<string, any>): Promise<ToolResult>;

  toParam() {
    return {
      type: 'function' as const,
      function: {
        name: this.name,
        description: this.description,
        parameters: this.parameters,
      },
    };
  }

  /**
   * Create a successful tool result
   */
  protected successResponse(data: Record<string, any> | string): ToolResult {
    if (typeof data === 'string') {
      return { output: data };
    }
    return { output: JSON.stringify(data, null, 2) };
  }

  /**
   * Create a failed tool result
   */
  protected failResponse(msg: string): ToolResult {
    return { error: msg };
  }
}

/**
 * Tool error class
 */
export class ToolError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ToolError';
  }
}
