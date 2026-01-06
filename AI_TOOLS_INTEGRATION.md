# AICoder Features Integration

This document describes the integration of AICoder functionality into Rebebuca.

## Overview

The [AICoder project](https://github.com/rapidai/aicoder) provides a unified dashboard for managing multiple AI CLI programming tools. We have integrated its key features into Rebebuca to enhance the task management capabilities with AI tool support.

## Integrated Features

### 1. AI Tool Configuration Management

**Location**: Settings → AI Tools tab

#### Supported AI Tools
- **Claude Code** - Anthropic's Claude Code CLI
- **Codex** - OpenAI's Codex CLI tool
- **Gemini CLI** - Google's Gemini CLI
- **OpenCode** - OpenCode AI assistant
- **CodeBuddy** - CodeBuddy programming assistant
- **Qoder CLI** - Qoder CLI programming assistant

#### Provider Support
Each AI tool can be configured with different service providers:

- **Original** - Uses the official default configuration (no custom settings)
- **GLM (智谱AI)** - Zhipu AI's GLM models
- **Kimi (月之暗面)** - Moonshot AI's Kimi models
- **Doubao (豆包)** - ByteDance's Doubao models
- **MiniMax** - MiniMax AI models
- **DeepSeek** - DeepSeek AI models
- **AIgoCode** - AIgoCode service
- **AiCodeMirror** - AiCodeMirror service
- **Custom** - Custom API endpoint

#### Key Features
- **API Key Management**: Centralized API key storage for all tools
- **Cross-Tool Sync**: API keys for the same provider automatically sync across different tools
- **Provider Presets**: Pre-configured endpoints for popular AI service providers
- **Get Key Links**: Direct links to provider websites for API key registration

### 2. Enhanced Task Configuration

**Location**: Task Edit Dialog

#### New Task Properties

##### Python Environment Support
- Configure Conda/Anaconda environment for Python-based tasks
- Automatically activates the specified environment before running commands
- Supports both Windows (`conda activate`) and Unix-like systems (`source activate`)

##### Administrator Privileges (Windows Only)
- Option to run tasks with administrator privileges
- Useful for tasks requiring elevated permissions
- Only available on Windows platform

##### AI Tool Integration
- Tasks can be associated with specific AI tools
- Environment variables are automatically injected based on tool configuration
- Supports custom API endpoints and provider-specific settings

### 3. AI Tool Quick Launch

**Location**: Command Plaza (Dialog accessible from task edit)

#### Launch Commands
- Dynamically generated launch commands for all enabled AI tools
- One-click addition to task commands
- Automatic environment variable configuration
- Support for project-specific paths

#### Command Templates
The launcher creates appropriate commands based on:
- Selected AI tool type
- Configured provider
- API keys and endpoints
- Project working directory

### 4. Launch Configuration System

#### Components

**AI Tools Store** (`src/stores/aiTools.ts`)
- Manages AI tool configurations
- Handles API key storage and synchronization
- Provider preset definitions

**AI Tool Launcher** (`src/utils/aiToolLauncher.ts`)
- Builds launch configurations
- Injects environment variables
- Wraps commands with Python environment activation
- Supports multiple launch modes (Original, Custom, Provider-specific)

**Task Types Extension** (`src/providers/types.ts`)
- Extended Task interface with:
  - `pythonEnv?: string` - Python environment name
  - `runAsAdmin?: boolean` - Administrator privilege flag
  - `aiTool?: string` - Associated AI tool type

### 5. User Interface

#### Settings Panel
- Clean, card-based UI for each AI tool
- Toggle to enable/disable tools
- Provider dropdown with all available options
- Secure password input for API keys
- "Get Key" button with direct links to provider registration pages
- Info alerts for special modes (Original mode notice)

#### Task Edit Dialog
- Python environment text input with tooltip
- Admin privilege toggle (Windows only)
- Seamless integration with existing task fields

#### Command Plaza
- Filtered AI tools category
- Search functionality
- Dynamically updated based on enabled tools

## Implementation Details

### Data Models

#### AIToolConfig
```typescript
interface AIToolConfig {
  toolType: AIToolType;
  provider: string;        // Provider ID
  apiKey?: string;         // API key for the provider
  customEndpoint?: string; // Custom API endpoint (for 'custom' provider)
  enabled: boolean;        // Whether the tool is enabled
}
```

#### Provider Preset
```typescript
interface ProviderPreset {
  id: string;
  name: string;
  apiEndpoint?: string;
  getKeyUrl?: string;
  supportsTools: AIToolType[];
}
```

### API Key Synchronization

When an API key is set for a provider:
1. The key is stored in the `providerKeys` map
2. All tools using the same provider are automatically updated
3. Changes are persisted to storage immediately

### Launch Configuration

When launching an AI tool:
1. Base command is determined (e.g., `npx @anthropic/claude-code`)
2. Project path is appended if provided
3. Environment variables are set based on:
   - Provider type (sets appropriate API base URL)
   - API key (sets tool-specific env var)
   - Custom endpoint (if using custom provider)
4. Python environment wrapper is applied if configured
5. Command is executed with system terminal if specified

### Original Mode

When "Original" provider is selected:
- No custom API keys or endpoints are configured
- Tool uses its default official configuration
- Ensures clean environment for official tool operation

## Translation Support

Full internationalization support for:
- Chinese (Simplified) - `src/locales/zh-CN.ts`
- English - `src/locales/en.ts`

All new UI elements, descriptions, and help text are fully translated.

## Future Enhancements

Potential improvements for future versions:

1. **Environment Auto-Detection**
   - Automatically detect available Conda environments
   - Provide dropdown selection instead of text input

2. **Tool Installation**
   - Automatic installation of AI tools
   - Version checking and update notifications

3. **Configuration Profiles**
   - Multiple configuration profiles per tool
   - Quick switching between different API keys/endpoints

4. **Usage Analytics**
   - Track API usage per tool
   - Cost estimation based on provider pricing

5. **Advanced Features**
   - Macro tasks combining multiple AI tools
   - Tool chaining and pipelines
   - Custom environment variable templates

## Technical Notes

### Storage
- AI tool configurations are stored in Tauri Store
- Storage keys: `ai_tool_configs` and `provider_keys`
- Automatic persistence on configuration changes

### Platform Detection
- Windows-specific features use async platform detection
- Graceful degradation for non-Windows platforms

### Security
- API keys stored securely in Tauri Store
- Password-type inputs in UI
- Keys never logged or exposed

## Testing

To test the integration:

1. **Enable an AI Tool**
   - Go to Settings → AI Tools
   - Toggle on a tool (e.g., Claude Code)
   - Select a provider
   - Enter an API key

2. **Create a Launch Task**
   - Open Command Plaza from task edit dialog
   - Browse to AI Tools category
   - Select a launch command
   - Save the task

3. **Configure Python Environment**
   - Edit a task
   - Set Python environment name
   - Run the task and verify environment activation

4. **Test API Key Sync**
   - Configure same provider for multiple tools
   - Verify keys sync automatically
   - Change key and verify all tools update

## Migration from AICoder

For users migrating from AICoder:

1. **Tool Support**
   - All major tools from AICoder are supported
   - Provider presets match AICoder's offerings

2. **Key Differences**
   - No automatic tool installation (manual setup required)
   - No built-in BBS/announcement system
   - Integration into task management system

3. **Advantages**
   - Unified task and AI tool management
   - More flexible task configuration
   - Cross-platform support via Tauri
   - Integration with existing workflows

## Contributing

To add support for new AI tools:

1. Add tool type to `AIToolType` in `src/stores/aiTools.ts`
2. Add display name to `getToolDisplayName` function
3. Add launch configuration to `getAIToolLaunchConfig` in `src/utils/aiToolLauncher.ts`
4. Add translations for the tool
5. Update this documentation

## License

This integration follows Rebebuca's GPL-3.0 license. The integration approach is inspired by AICoder but implemented independently.
