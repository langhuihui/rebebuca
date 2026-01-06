<!--
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
 -->

<template>
  <n-modal 
    v-model:show="showDialog"
    preset="card"
    :title="t('commandPlaza.title')"
    style="width: 700px; max-height: 80vh;"
    :bordered="false"
    to="body"
  >
    <div class="command-plaza">
      <!-- Search input -->
      <n-input
        v-model:value="searchQuery"
        :placeholder="t('commandPlaza.searchPlaceholder')"
        clearable
        class="search-input"
      >
        <template #prefix>
          <n-icon size="16">
            <component :is="svgIcons.search" />
          </n-icon>
        </template>
      </n-input>
      
      <!-- Category tabs -->
      <n-tabs v-model:value="activeCategory" type="line" size="small" class="category-tabs">
        <n-tab-pane 
          v-for="category in categories" 
          :key="category.key" 
          :name="category.key"
          :tab="category.label"
        />
      </n-tabs>
      
      <!-- Commands table -->
      <n-data-table
        :columns="columns"
        :data="filteredCommands"
        :max-height="400"
        :bordered="false"
        size="small"
        class="commands-table"
      />
      
      <!-- Empty state -->
      <n-empty 
        v-if="filteredCommands.length === 0" 
        :description="t('commandPlaza.noResults')"
        class="empty-state"
      />
    </div>
  </n-modal>
</template>

<script setup lang="ts">
import { ref, computed, h, onMounted } from 'vue';
import {
  NModal,
  NInput,
  NTabs,
  NTabPane,
  NDataTable,
  NButton,
  NIcon,
  NEmpty,
  NTooltip,
  type DataTableColumns,
} from 'naive-ui';
import { useI18n } from 'vue-i18n';
import { svgIcons } from '../../../utils/icons';
import { useAIToolsStore, type AIToolType } from '../../../stores/aiTools';
import { createAIToolQuickLaunchTask } from '../../../utils/aiToolLauncher';

// Command item interface
interface CommandItem {
  id: string;
  name: string;
  command: string;
  category: string;
  description?: string;
}

const props = defineProps<{
  show: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:show', value: boolean): void;
  (e: 'select', command: string, name: string): void;
}>();

const { t } = useI18n();
const aiToolsStore = useAIToolsStore();

// Load AI tool configurations on mount
onMounted(async () => {
  await aiToolsStore.loadConfigurations();
});

const showDialog = computed({
  get: () => props.show,
  set: (value) => emit('update:show', value),
});

const searchQuery = ref('');
const activeCategory = ref('all');

// Categories
const categories = computed(() => [
  { key: 'all', label: t('commandPlaza.categoryAll') },
  { key: 'ai-tools', label: t('commandPlaza.categoryAiTools') },
  { key: 'package-manager', label: t('commandPlaza.categoryPackageManager') },
  { key: 'dev-tools', label: t('commandPlaza.categoryDevTools') },
]);

// Predefined commands - AI programming tools CLI update commands
const commands = computed<CommandItem[]>(() => {
  const baseCommands: CommandItem[] = [
  // AI Programming Tools - Launch Commands (dynamically added based on enabled tools)
  ];
  
  // Add AI tool launch commands for enabled tools
  const toolDescKeys: Record<string, string> = {
    'claude-code': 'claudeCodeLaunch',
    'codex': 'codexLaunch',
    'gemini-cli': 'geminiCliLaunch',
    'opencode': 'opencodeLaunch',
    'codebuddy': 'codebuddyLaunch',
    'qoder-cli': 'qoderLaunch',
    'copilot-cli': 'copilotCliLaunch',
    'droid': 'droidLaunch',
  };
  
  for (const [toolType, config] of Object.entries(aiToolsStore.toolConfigs)) {
    if (config.enabled) {
      const launchTask = createAIToolQuickLaunchTask(toolType as AIToolType, config);
      baseCommands.push({
        id: `${toolType}-launch`,
        name: launchTask.name,
        command: launchTask.command,
        category: 'ai-tools',
        description: t(`commandPlaza.desc.${toolDescKeys[toolType]}`),
      });
    }
  }
  
  // AI update commands
  baseCommands.push(
  {
    id: 'cursor-update',
    name: 'Cursor Update',
    command: 'cursor --update',
    category: 'ai-tools',
    description: t('commandPlaza.desc.cursorUpdate'),
  },
  {
    id: 'claude-code-update',
    name: 'Claude Code (npm)',
    command: 'npm update -g @anthropic-ai/claude-code',
    category: 'ai-tools',
    description: t('commandPlaza.desc.claudeCodeUpdate'),
  },
  {
    id: 'codebuddy-update',
    name: 'CodeBuddy Code Update',
    command: 'codebuddy update',
    category: 'ai-tools',
    description: t('commandPlaza.desc.codebuddyUpdate'),
  },
  {
    id: 'github-copilot-cli-update',
    name: 'GitHub Copilot CLI',
    command: 'npm update -g @githubnext/github-copilot-cli',
    category: 'ai-tools',
    description: t('commandPlaza.desc.copilotCliUpdate'),
  },
  {
    id: 'aider-update',
    name: 'Aider Update',
    command: 'pip install --upgrade aider-chat',
    category: 'ai-tools',
    description: t('commandPlaza.desc.aiderUpdate'),
  },
  {
    id: 'continue-update',
    name: 'Continue Extension',
    command: 'code --install-extension continue.continue --force',
    category: 'ai-tools',
    description: t('commandPlaza.desc.continueUpdate'),
  },
  {
    id: 'cline-update',
    name: 'Cline Extension',
    command: 'code --install-extension saoudrizwan.claude-dev --force',
    category: 'ai-tools',
    description: t('commandPlaza.desc.clineUpdate'),
  },
  {
    id: 'tabby-update',
    name: 'Tabby Server',
    command: 'pip install --upgrade tabby-server',
    category: 'ai-tools',
    description: t('commandPlaza.desc.tabbyUpdate'),
  },
  {
    id: 'ollama-update',
    name: 'Ollama Update',
    command: 'ollama pull llama3.2',
    category: 'ai-tools',
    description: t('commandPlaza.desc.ollamaUpdate'),
  },
  {
    id: 'llm-cli-update',
    name: 'LLM CLI',
    command: 'pip install --upgrade llm',
    category: 'ai-tools',
    description: t('commandPlaza.desc.llmCliUpdate'),
  },
  
  // Package Managers
  {
    id: 'npm-update-global',
    name: 'NPM Global Update',
    command: 'npm update -g',
    category: 'package-manager',
    description: t('commandPlaza.desc.npmGlobalUpdate'),
  },
  {
    id: 'pnpm-update-global',
    name: 'PNPM Global Update',
    command: 'pnpm update -g',
    category: 'package-manager',
    description: t('commandPlaza.desc.pnpmGlobalUpdate'),
  },
  {
    id: 'yarn-upgrade-global',
    name: 'Yarn Global Upgrade',
    command: 'yarn global upgrade',
    category: 'package-manager',
    description: t('commandPlaza.desc.yarnGlobalUpgrade'),
  },
  {
    id: 'pip-upgrade-all',
    name: 'PIP Upgrade All',
    command: 'pip list --outdated --format=freeze | grep -v "^\\-e" | cut -d = -f 1 | xargs -n1 pip install -U',
    category: 'package-manager',
    description: t('commandPlaza.desc.pipUpgradeAll'),
  },
  {
    id: 'brew-upgrade',
    name: 'Homebrew Upgrade',
    command: 'brew update && brew upgrade',
    category: 'package-manager',
    description: t('commandPlaza.desc.brewUpgrade'),
  },
  {
    id: 'cargo-install-update',
    name: 'Cargo Install Update',
    command: 'cargo install-update -a',
    category: 'package-manager',
    description: t('commandPlaza.desc.cargoInstallUpdate'),
  },
  
  // Dev Tools
  {
    id: 'node-version',
    name: 'Node Version',
    command: 'node --version',
    category: 'dev-tools',
    description: t('commandPlaza.desc.nodeVersion'),
  },
  {
    id: 'npm-version',
    name: 'NPM Version',
    command: 'npm --version',
    category: 'dev-tools',
    description: t('commandPlaza.desc.npmVersion'),
  },
  {
    id: 'git-version',
    name: 'Git Version',
    command: 'git --version',
    category: 'dev-tools',
    description: t('commandPlaza.desc.gitVersion'),
  },
  {
    id: 'rust-update',
    name: 'Rust Update',
    command: 'rustup update',
    category: 'dev-tools',
    description: t('commandPlaza.desc.rustUpdate'),
  },
  {
    id: 'go-version',
    name: 'Go Version',
    command: 'go version',
    category: 'dev-tools',
    description: t('commandPlaza.desc.goVersion'),
  },
  {
    id: 'python-version',
    name: 'Python Version',
    command: 'python --version',
    category: 'dev-tools',
    description: t('commandPlaza.desc.pythonVersion'),
  });
  
  return baseCommands;
});

// Filtered commands based on search and category
const filteredCommands = computed(() => {
  let result = commands.value;
  
  // Filter by category
  if (activeCategory.value !== 'all') {
    result = result.filter(cmd => cmd.category === activeCategory.value);
  }
  
  // Filter by search query
  if (searchQuery.value.trim()) {
    const query = searchQuery.value.toLowerCase();
    result = result.filter(cmd => 
      cmd.name.toLowerCase().includes(query) ||
      cmd.command.toLowerCase().includes(query) ||
      (cmd.description?.toLowerCase().includes(query))
    );
  }
  
  return result;
});

// Handle command selection
const handleSelect = (command: string, name: string) => {
  emit('select', command, name);
  showDialog.value = false;
};

// Table columns
const columns = computed<DataTableColumns<CommandItem>>(() => [
  {
    title: t('commandPlaza.columnName'),
    key: 'name',
    width: 180,
    ellipsis: {
      tooltip: true,
    },
  },
  {
    title: t('commandPlaza.columnCommand'),
    key: 'command',
    ellipsis: {
      tooltip: true,
    },
    render(row) {
      return h('code', { class: 'command-code' }, row.command);
    },
  },
  {
    title: t('commandPlaza.columnAction'),
    key: 'action',
    width: 80,
    align: 'center',
    render(row) {
      return h(
        NTooltip,
        { trigger: 'hover' },
        {
          trigger: () => h(
            NButton,
            {
              size: 'small',
              type: 'primary',
              quaternary: true,
              onClick: () => handleSelect(row.command, row.name),
            },
            {
              icon: () => h(NIcon, { size: 16 }, () => h(svgIcons.plus)),
            }
          ),
          default: () => t('commandPlaza.addToCommand'),
        }
      );
    },
  },
]);
</script>

<style scoped>
.command-plaza {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.search-input {
  margin-bottom: 4px;
}

.category-tabs {
  margin-bottom: 8px;
}

.commands-table {
  flex: 1;
}

.commands-table :deep(.command-code) {
  font-family: monospace;
  font-size: 12px;
  background: rgba(0, 0, 0, 0.06);
  padding: 2px 6px;
  border-radius: 3px;
  color: var(--n-text-color);
}

.empty-state {
  padding: 40px 0;
}

/* Dark theme adjustments */
:global(.n-config-provider--dark) .commands-table :deep(.command-code) {
  background: rgba(255, 255, 255, 0.08);
}
</style>
