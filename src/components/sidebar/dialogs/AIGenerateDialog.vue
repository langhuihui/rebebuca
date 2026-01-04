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
    preset="dialog"
    :title="t('task.aiGenerate')"
    style="width: 600px;"
    :show-icon="false"
    to="body"
  >
    <div class="ai-dialog-content">
      <!-- AI Provider Selection -->
      <n-form-item :label="t('task.aiProvider')">
        <n-select
          v-model:value="aiConfig.provider"
          :options="aiProviderOptions"
        />
      </n-form-item>
      
      <!-- Ollama Settings -->
      <template v-if="aiConfig.provider === 'ollama'">
        <n-form-item :label="t('task.ollamaUrl')">
          <n-input
            v-model:value="aiConfig.ollamaUrl"
            :placeholder="'http://localhost:11434'"
          />
        </n-form-item>
        <n-form-item :label="t('task.ollamaModel')">
          <n-select
            v-model:value="aiConfig.ollamaModel"
            :options="ollamaModelOptions"
            filterable
            tag
          />
        </n-form-item>
      </template>
      
      <!-- API Key Input (for non-Ollama providers) -->
      <n-form-item v-if="aiConfig.provider !== 'ollama'" :label="t('task.aiApiKey')">
        <n-input
          v-model:value="aiConfig.apiKey"
          type="password"
          show-password-on="click"
          :placeholder="t('task.aiApiKeyPlaceholder')"
        />
      </n-form-item>
      
      <!-- Chat Input -->
      <n-form-item :label="t('task.aiPrompt')">
        <n-input
          v-model:value="aiConfig.prompt"
          type="textarea"
          :placeholder="t('task.aiPromptPlaceholder')"
          :autosize="{ minRows: 3, maxRows: 6 }"
        />
      </n-form-item>
      
      <!-- Generate Button -->
      <div class="ai-actions">
        <n-button 
          type="primary" 
          :loading="aiConfig.loading"
          :disabled="(aiConfig.provider !== 'ollama' && !aiConfig.apiKey) || !aiConfig.prompt"
          @click="handleGenerate"
        >
          {{ t('task.aiGenerateBtn') }}
        </n-button>
      </div>
      
      <!-- Generated Result -->
      <div v-if="aiConfig.result" class="ai-result">
        <n-divider>{{ t('task.aiResult') }}</n-divider>
        <div class="generated-task">
          <div class="result-item">
            <span class="result-label">{{ t('task.name') }}:</span>
            <span class="result-value">{{ aiConfig.result.name }}</span>
          </div>
          <div class="result-item">
            <span class="result-label">{{ t('task.command') }}:</span>
            <span class="result-value monospace">{{ aiConfig.result.command }}</span>
          </div>
          <div v-if="aiConfig.result.args?.length" class="result-item">
            <span class="result-label">{{ t('task.args') }}:</span>
            <span class="result-value monospace">{{ aiConfig.result.args.join(' ') }}</span>
          </div>
          <div v-if="aiConfig.result.cwd" class="result-item">
            <span class="result-label">{{ t('task.cwd') }}:</span>
            <span class="result-value monospace">{{ aiConfig.result.cwd }}</span>
          </div>
        </div>
        <div class="ai-result-actions">
          <n-button @click="$emit('add-result', aiConfig.result)">{{ t('task.addToTasks') }}</n-button>
          <n-button tertiary @click="$emit('edit-result', aiConfig.result)">{{ t('task.editAndAdd') }}</n-button>
        </div>
      </div>
      
      <!-- Error Message -->
      <n-alert v-if="aiConfig.error" type="error" :title="t('error.title')" style="margin-top: 16px;">
        {{ aiConfig.error }}
      </n-alert>
    </div>
  </n-modal>
</template>

<script setup lang="ts">
import { reactive, computed } from 'vue';
import {
  NModal,
  NFormItem,
  NInput,
  NSelect,
  NButton,
  NDivider,
  NAlert,
} from 'naive-ui';
import { useI18n } from 'vue-i18n';
import type { TaskGroup } from '../../../providers/types';

interface AIGeneratedTask {
  name: string;
  command: string;
  args?: string[];
  cwd?: string;
  group?: TaskGroup;
  type?: 'shell' | 'process';
}

const props = defineProps<{
  show: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:show', value: boolean): void;
  (e: 'add-result', result: AIGeneratedTask): void;
  (e: 'edit-result', result: AIGeneratedTask): void;
}>();

const { t } = useI18n();

const showDialog = computed({
  get: () => props.show,
  set: (value) => emit('update:show', value),
});

const aiConfig = reactive({
  provider: 'ollama' as 'ollama' | 'openai' | 'anthropic' | 'deepseek',
  apiKey: '',
  ollamaUrl: 'http://localhost:11434',
  ollamaModel: 'qwen2.5:3b',
  prompt: '',
  loading: false,
  result: null as AIGeneratedTask | null,
  error: '',
});

const aiProviderOptions = [
  { label: 'Ollama (本地)', value: 'ollama' },
  { label: 'OpenAI (GPT-4)', value: 'openai' },
  { label: 'Anthropic (Claude)', value: 'anthropic' },
  { label: 'DeepSeek', value: 'deepseek' },
];

const ollamaModelOptions = [
  { label: 'Qwen2.5 3B', value: 'qwen2.5:3b' },
  { label: 'Qwen2.5 Coder 3B', value: 'qwen2.5-coder:3b' },
  { label: 'Qwen2.5 7B', value: 'qwen2.5:7b' },
  { label: 'Llama3.2 3B', value: 'llama3.2:3b' },
  { label: 'Phi3 Mini', value: 'phi3:mini' },
  { label: 'Mistral 7B', value: 'mistral:7b' },
];

const handleGenerate = async () => {
  if (aiConfig.provider !== 'ollama' && !aiConfig.apiKey) return;
  if (!aiConfig.prompt) return;
  
  aiConfig.loading = true;
  aiConfig.error = '';
  aiConfig.result = null;
  
  try {
    const systemPrompt = `You are a helpful assistant that generates shell command configurations.
Given a user's description, generate a task configuration in JSON format with:
- name: A short descriptive name for the task
- command: The main command to run (just the executable, e.g., "npm", "go", "docker")
- args: An array of arguments (optional)
- cwd: Working directory (optional, use relative paths if needed)
- group: One of "none", "build", "test", "clean" (optional)
- type: Either "shell" or "process" (default: "shell")

Respond ONLY with valid JSON, no explanations or markdown code blocks.`;

    const userMessage = aiConfig.prompt;
    
    let response: Response;
    let result: any;
    let content = '';
    
    if (aiConfig.provider === 'ollama') {
      response = await fetch(`${aiConfig.ollamaUrl}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: aiConfig.ollamaModel,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMessage },
          ],
          stream: false,
          options: {
            temperature: 0.7,
          },
        }),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Ollama API error - 请确保 Ollama 服务正在运行');
      }
      
      result = await response.json();
      content = result.message?.content || '';
      
    } else if (aiConfig.provider === 'openai') {
      response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${aiConfig.apiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMessage },
          ],
          temperature: 0.7,
        }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'OpenAI API error');
      }
      
      result = await response.json();
      content = result.choices?.[0]?.message?.content || '';
      
    } else if (aiConfig.provider === 'anthropic') {
      response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': aiConfig.apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: 'claude-3-haiku-20240307',
          max_tokens: 1024,
          system: systemPrompt,
          messages: [
            { role: 'user', content: userMessage },
          ],
        }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'Anthropic API error');
      }
      
      result = await response.json();
      content = result.content?.[0]?.text || '';
      
    } else if (aiConfig.provider === 'deepseek') {
      response = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${aiConfig.apiKey}`,
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMessage },
          ],
          temperature: 0.7,
        }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'DeepSeek API error');
      }
      
      result = await response.json();
      content = result.choices?.[0]?.message?.content || '';
    }
    
    if (content) {
      const cleanContent = content.replace(/```json\n?|\n?```/g, '').trim();
      aiConfig.result = JSON.parse(cleanContent);
    }
    
  } catch (error) {
    console.error('[AIGenerateDialog] AI generate failed:', error);
    aiConfig.error = String(error);
  } finally {
    aiConfig.loading = false;
  }
};

// Expose methods for external use
defineExpose({
  reset: () => {
    aiConfig.result = null;
    aiConfig.prompt = '';
    aiConfig.error = '';
  },
});
</script>

<style scoped>
.ai-dialog-content {
  padding: 8px 0;
}

.ai-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
}

.ai-result {
  margin-top: 8px;
}

.generated-task {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  padding: 12px;
}

.result-item {
  display: flex;
  margin-bottom: 8px;
}

.result-item:last-child {
  margin-bottom: 0;
}

.result-label {
  width: 80px;
  flex-shrink: 0;
  color: rgba(255, 255, 255, 0.6);
  font-size: 13px;
}

.result-value {
  flex: 1;
  font-size: 13px;
}

.result-value.monospace {
  font-family: monospace;
}

.ai-result-actions {
  display: flex;
  gap: 8px;
  margin-top: 16px;
  justify-content: flex-end;
}

/* Light theme */
:global(.n-config-provider--light) .generated-task {
  background: rgba(0, 0, 0, 0.03);
}

:global(.n-config-provider--light) .result-label {
  color: rgba(0, 0, 0, 0.5);
}
</style>
