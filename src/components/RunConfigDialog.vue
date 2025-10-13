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
    v-model:show="show"
    preset="dialog"
    title="运行配置"
    style="width: 600px"
  >
    <template #action>
      <n-space>
        <n-button @click="handleCancel">
          <template #icon>
            <n-icon size="18">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </n-icon>
          </template>
        </n-button>
        <n-button type="primary" @click="handleSave">
          <template #icon>
            <n-icon size="18">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
            </n-icon>
          </template>
        </n-button>
      </n-space>
    </template>
    <n-form
      ref="formRef"
      :model="formValue"
      :rules="rules"
      label-placement="left"
      label-width="auto"
      require-mark-placement="right-hanging"
      size="medium"
    >
      <n-form-item label="配置名称" path="name">
        <n-input v-model:value="formValue.name" placeholder="请输入配置名称" />
      </n-form-item>

      <n-form-item label="执行程序" path="command">
        <n-input
          v-model:value="formValue.command"
          placeholder="请输入程序路径或命令"
        >
          <template #suffix>
            <n-button text @click="selectProgram">
              <template #icon>
                <n-icon size="16">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <path
                      d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"
                    ></path>
                    <polyline points="13 2 13 9 20 9"></polyline>
                  </svg>
                </n-icon>
              </template>
            </n-button>
          </template>
        </n-input>
      </n-form-item>

      <n-form-item label="工作目录" path="workingDirectory">
        <n-input
          v-model:value="formValue.workingDirectory"
          placeholder="请输入工作目录路径"
        >
          <template #suffix>
            <n-button text @click="selectWorkingDirectory">
              <template #icon>
                <n-icon size="16">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <path
                      d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"
                    ></path>
                  </svg>
                </n-icon>
              </template>
            </n-button>
          </template>
        </n-input>
      </n-form-item>

      <n-form-item label="命令行参数" path="arguments">
        <div style="width: 100%">
          <n-space vertical style="width: 100%">
            <n-button-group>
              <n-button
                :type="argumentsMode === 'list' ? 'primary' : 'default'"
                @click="argumentsMode = 'list'"
                size="small"
              >
                <template #icon>
                  <n-icon size="16">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    >
                      <line x1="8" y1="6" x2="21" y2="6"></line>
                      <line x1="8" y1="12" x2="21" y2="12"></line>
                      <line x1="8" y1="18" x2="21" y2="18"></line>
                      <line x1="3" y1="6" x2="3.01" y2="6"></line>
                      <line x1="3" y1="12" x2="3.01" y2="12"></line>
                      <line x1="3" y1="18" x2="3.01" y2="18"></line>
                    </svg>
                  </n-icon>
                </template>
              </n-button>
              <n-button
                :type="argumentsMode === 'text' ? 'primary' : 'default'"
                @click="toggleArgumentsMode"
                size="small"
              >
                <template #icon>
                  <n-icon size="16">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    >
                      <path
                        d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"
                      ></path>
                    </svg>
                  </n-icon>
                </template>
              </n-button>
            </n-button-group>

            <n-dynamic-input
              v-if="argumentsMode === 'list'"
              v-model:value="formValue.arguments"
              placeholder="请输入参数"
              :min="0"
            />

            <n-input
              v-else
              v-model:value="argumentsText"
              type="textarea"
              placeholder="请输入参数，用空格分隔"
              :autosize="{
                minRows: 3,
                maxRows: 6,
              }"
            />
          </n-space>
        </div>
      </n-form-item>

      <n-form-item label="环境变量" path="environment">
        <n-dynamic-input
          v-model:value="formValue.environment"
          placeholder="变量名=值"
          :min="0"
          #="{ value }"
        >
          <n-input-group>
            <n-input
              v-model:value="value.key"
              placeholder="变量名"
              style="width: 40%"
            />
            <n-input
              v-model:value="value.value"
              placeholder="值"
              style="width: 60%"
            />
          </n-input-group>
        </n-dynamic-input>
      </n-form-item>
    </n-form>
  </n-modal>
</template>

<script setup lang="ts">
import { ref, watch, computed } from "vue";
import { FormInst, useMessage, NSpace, NButton, NIcon } from "naive-ui";
import { open } from "@tauri-apps/plugin-dialog";
import type { RunConfig } from "../stores/runConfig";

interface Props {
  show: boolean;
  config?: RunConfig | null;
}

interface Emits {
  (e: "update:show", value: boolean): void;
  (e: "saved", config: RunConfig): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const message = useMessage();
const formRef = ref<FormInst | null>(null);

// Form data
const formValue = ref({
  name: "",
  command: "",
  workingDirectory: "",
  arguments: [] as string[],
  environment: [] as Array<{ key: string; value: string }>,
});

// Arguments display mode: 'list' or 'text'
const argumentsMode = ref<"list" | "text">("list");
const argumentsText = ref("");

// Form validation rules
const rules = {
  name: {
    required: true,
    message: "请输入配置名称",
    trigger: ["input", "blur"],
  },
  command: {
    required: true,
    message: "请输入执行命令",
    trigger: ["input", "blur"],
  },
};

// Computed properties
const show = computed({
  get: () => props.show,
  set: (value: boolean) => emit("update:show", value),
});

// Handler methods for file/folder selection
const selectProgram = async () => {
  try {
    const selected = await open({
      multiple: false,
      directory: false,
      title: "选择可执行程序",
    });
    if (selected && typeof selected === "string") {
      formValue.value.command = selected;
    }
  } catch (error) {
    console.error("Failed to select program:", error);
  }
};

const selectWorkingDirectory = async () => {
  try {
    const selected = await open({
      multiple: false,
      directory: true,
      title: "选择工作目录",
    });
    if (selected && typeof selected === "string") {
      formValue.value.workingDirectory = selected;
    }
  } catch (error) {
    console.error("Failed to select directory:", error);
  }
};

// Parse command line arguments properly handling quotes
const parseArguments = (text: string): string[] => {
  const args: string[] = [];
  let current = "";
  let inQuotes = false;
  let quoteChar = "";

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (!inQuotes) {
      if (char === '"' || char === "'") {
        inQuotes = true;
        quoteChar = char;
      } else if (char === " " || char === "\t" || char === "\n") {
        if (current.trim()) {
          args.push(current.trim());
          current = "";
        }
      } else {
        current += char;
      }
    } else {
      if (char === quoteChar) {
        inQuotes = false;
        quoteChar = "";
      } else {
        current += char;
      }
    }
  }

  if (current.trim()) {
    args.push(current.trim());
  }

  return args;
};

// Remove surrounding quotes from arguments (handle nested quotes)
const removeQuotes = (args: string[]): string[] => {
  return args.map((arg) => {
    // Keep removing quotes until no more outer quotes exist
    let result = arg;
    while (
      (result.length >= 2 && result.startsWith('"') && result.endsWith('"')) ||
      (result.length >= 2 && result.startsWith("'") && result.endsWith("'"))
    ) {
      result = result.slice(1, -1);
    }
    return result;
  });
};

// Add quotes to arguments that contain spaces, but avoid double quotes
const addQuotesIfNeeded = (args: string[]): string[] => {
  return args.map((arg) => {
    // If argument contains spaces and is not already quoted
    if (
      arg.includes(" ") &&
      !(arg.startsWith('"') && arg.endsWith('"')) &&
      !(arg.startsWith("'") && arg.endsWith("'"))
    ) {
      return `"${arg}"`;
    }
    return arg;
  });
};

// Toggle arguments mode
const toggleArgumentsMode = () => {
  if (argumentsMode.value === "list") {
    // Switch to text mode - add quotes to arguments that contain spaces (avoid double quotes)
    argumentsText.value = addQuotesIfNeeded(formValue.value.arguments).join(
      " "
    );
    argumentsMode.value = "text";
  } else {
    // Switch to list mode - parse arguments and remove quotes
    formValue.value.arguments = removeQuotes(
      parseArguments(argumentsText.value)
    );
    argumentsMode.value = "list";
  }
};

// Sync arguments when in text mode
const syncArgumentsFromText = () => {
  if (argumentsMode.value === "text") {
    formValue.value.arguments = removeQuotes(
      parseArguments(argumentsText.value)
    );
  }
};

// Watch for config changes
watch(
  () => props.config,
  (newConfig) => {
    if (newConfig) {
      formValue.value = {
        name: newConfig.name,
        command: newConfig.command,
        workingDirectory: newConfig.workingDirectory || "",
        arguments: newConfig.arguments || [],
        environment: Object.entries(newConfig.environment || {}).map(
          ([key, value]) => ({
            key,
            value,
          })
        ),
      };
      argumentsMode.value = "list";
      // Display arguments with quotes for text mode (avoid double quotes)
      argumentsText.value = addQuotesIfNeeded(newConfig.arguments || []).join(
        " "
      );
    } else {
      // Reset form
      formValue.value = {
        name: "",
        command: "",
        workingDirectory: "",
        arguments: [],
        environment: [],
      };
      argumentsMode.value = "list";
      argumentsText.value = "";
    }
  },
  { immediate: true }
);

// Handler methods
const handleSave = () => {
  // Sync arguments from text mode if needed
  syncArgumentsFromText();

  formRef.value?.validate((errors) => {
    if (errors) {
      message.error("请检查表单数据");
      return;
    }

    // Convert environment variables format
    const environment = formValue.value.environment.reduce((acc, item) => {
      if (item.key && item.value) {
        acc[item.key] = item.value;
      }
      return acc;
    }, {} as Record<string, string>);

    const configData = {
      name: formValue.value.name,
      command: formValue.value.command,
      workingDirectory: formValue.value.workingDirectory || undefined,
      arguments: formValue.value.arguments,
      environment,
    };

    emit("saved", configData as any);
    message.success("配置保存成功");
    show.value = false;
  });
};

const handleCancel = () => {
  show.value = false;
};
</script>
