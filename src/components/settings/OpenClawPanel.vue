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
  <div class="openclaw-panel">
    <div class="openclaw-layout">
      <!-- Left sidebar with categories and tools -->
      <div class="openclaw-sidebar">
        <div
          v-for="cat in categories"
          :key="cat.id"
          class="sidebar-category"
        >
          <div class="category-header" @click="toggleCategory(cat.id)">
            <span class="category-arrow" :class="{ expanded: expandedCategories[cat.id] }">▸</span>
            <span class="category-label">{{ cat.label }}</span>
            <n-tag size="tiny" :bordered="false" round>{{ cat.tools.length }}</n-tag>
          </div>
          <transition name="collapse">
            <div v-show="expandedCategories[cat.id]" class="category-tools">
              <div
                v-for="tool in cat.tools"
                :key="tool.id"
                class="tool-item"
                :class="{ active: activeToolId === tool.id }"
                @click="activeToolId = tool.id"
              >
                <span class="tool-icon" :class="getToolIconClass(tool)">{{ tool.icon }}</span>
                <span class="tool-name">{{ tool.name }}</span>
                <n-tag
                  v-if="tool.tag"
                  size="tiny"
                  :type="getTagType(tool.tag)"
                  round
                  style="margin-left: auto"
                >
                  {{ tool.tag }}
                </n-tag>
              </div>
            </div>
          </transition>
        </div>
      </div>

      <!-- Right content area -->
      <div class="openclaw-content">
        <template v-for="cat in categories" :key="cat.id">
          <template v-for="tool in cat.tools" :key="tool.id">
            <div v-if="activeToolId === tool.id" class="tool-detail">
              <!-- Header -->
              <div class="detail-header">
                <div class="detail-title-row">
                  <span class="detail-icon" :class="getToolIconClass(tool)">{{ tool.icon }}</span>
                  <h3 class="detail-name">{{ tool.name }}</h3>
                  <n-tag v-if="tool.tag" :type="getTagType(tool.tag)" size="small" round>
                    {{ tool.tag }}
                  </n-tag>
                </div>
                <div class="detail-meta">
                  <n-tag v-if="tool.language" size="small" :bordered="false">
                    {{ tool.language }}
                  </n-tag>
                  <n-tag v-if="tool.vendor" size="small" :bordered="false" type="info">
                    {{ tool.vendor }}
                  </n-tag>
                  <n-tag v-if="tool.stars" size="small" :bordered="false" type="warning">
                    ⭐ {{ tool.stars }}
                  </n-tag>
                  <n-tag v-if="tool.size" size="small" :bordered="false" type="success">
                    {{ tool.size }}
                  </n-tag>
                </div>
              </div>

              <!-- Description -->
              <p class="detail-description">{{ tool.description }}</p>

              <!-- Features -->
              <div v-if="tool.features.length" class="detail-section">
                <h4 class="section-title">{{ t('openClaw.coreFeatures') }}</h4>
                <div class="features-grid">
                  <div v-for="(feat, idx) in tool.features" :key="idx" class="feature-item">
                    <span class="feature-bullet">✦</span>
                    <span>{{ feat }}</span>
                  </div>
                </div>
              </div>

              <!-- Links -->
              <div class="detail-section">
                <div class="links-row">
                  <a v-if="tool.website" class="tool-link" @click="openUrl(tool.website)">
                    <n-icon size="14"><component :is="svgIcons.externalLink" /></n-icon>
                    {{ t('openClaw.visitWebsite') }}
                    <span class="link-url">{{ tool.website }}</span>
                  </a>
                  <a v-if="tool.github" class="tool-link" @click="openUrl(tool.github)">
                    <n-icon size="14"><component :is="svgIcons.github" /></n-icon>
                    GitHub
                    <span class="link-url">{{ tool.github }}</span>
                  </a>
                  <a v-if="tool.docs" class="tool-link tool-link--primary" @click="openUrl(tool.docs)">
                    <n-icon size="14"><component :is="svgIcons.externalLink" /></n-icon>
                    {{ t('openClaw.viewTutorial') }}
                    <span class="link-url">{{ tool.docs }}</span>
                  </a>
                </div>
              </div>

              <!-- Install -->
              <div v-if="tool.installMethods && tool.installMethods.length" class="detail-section">
                <n-divider style="margin: 12px 0 8px 0">{{ t('openClaw.installOptions') }}</n-divider>
                <div v-for="method in tool.installMethods" :key="method.name" class="install-row">
                  <span class="method-label">{{ method.name }}</span>
                  <n-input-group>
                    <n-input
                      :value="method.command"
                      readonly
                      size="small"
                      class="install-input"
                    />
                    <n-button size="small" @click="copyCommand(method.command)">
                      <template #icon>
                        <n-icon size="14"><component :is="svgIcons.copy" /></n-icon>
                      </template>
                    </n-button>
                  </n-input-group>
                </div>
              </div>

              <!-- Tech Stack -->
              <div v-if="tool.techStack" class="detail-section">
                <n-text depth="3" style="font-size: 12px">
                  {{ t('openClaw.techStack') }}: {{ tool.techStack }}
                </n-text>
              </div>
            </div>
          </template>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  NTag,
  NButton,
  NIcon,
  NDivider,
  NInput,
  NInputGroup,
  useMessage,
} from 'naive-ui';
import { svgIcons } from '../../utils/icons';

interface OpenClawTool {
  id: string;
  name: string;
  icon: string;
  tag?: string;
  vendor?: string;
  language?: string;
  website?: string;
  github?: string;
  docs?: string;
  stars?: string;
  size?: string;
  description: string;
  features: string[];
  installMethods?: { name: string; command: string }[];
  techStack?: string;
}

interface Category {
  id: string;
  label: string;
  tools: OpenClawTool[];
}

const { t } = useI18n();
const message = useMessage();

const categories: Category[] = [
  {
    id: 'core',
    label: '🦞 OpenClaw 核心',
    tools: [
      {
        id: 'openclaw',
        name: 'OpenClaw',
        icon: '🦞',
        tag: '核心',
        website: 'https://github.com/openclaw/openclaw',
        github: 'https://github.com/openclaw/openclaw',
        stars: '260K+',
        description: '全球开源项目 TOP1（26万+ Stars），超越 React 和 Linux。本地优先的自主 AI Agent OS，支持 50+ 通讯平台、多模型、700+ 技能市场。',
        features: [
          '本地优先，所有数据存储在本地',
          '自主执行：操作系统、访问网页、处理邮件、写代码',
          '50+ 通讯平台：WhatsApp、Telegram、Slack、Discord、飞书、钉钉、微信等',
          '多模型支持：Claude、GPT、DeepSeek、Ollama 等',
          'ClawHub 技能市场提供 700+ 社区技能',
          'QMD 记忆系统，Token 削减 60-97%',
        ],
        installMethods: [
          { name: 'NPM', command: 'npm install -g openclaw' },
          { name: '一键部署', command: 'curl -fsSL https://get.openclaw.dev | sh' },
        ],
        techStack: 'TypeScript / Node.js',
      },
    ],
  },
  {
    id: 'cloud',
    label: '☁️ 云端托管',
    tools: [
      {
        id: 'kimiClaw',
        name: 'KimiClaw',
        icon: '🌙',
        tag: '云端',
        vendor: 'Moonshot AI（月之暗面）',
        website: 'https://kimi.moonshot.cn',
        docs: 'https://openclaw.dev/docs/cloud/kimiclaw',
        description: '云端运行，40GB 云存储，集成 Kimi K2.5 模型，5000+ 技能。支持微博接入（关注 @微博龙虾助手 即可远程控制），支持浏览器标签页运行，全天候在线。',
        features: [
          '云端运行，40GB 云存储',
          '集成 Kimi K2.5 模型',
          '5000+ 技能',
          '支持微博接入远程控制',
          '容器部署，可生成 Web 应用并通过隧道分享',
        ],
        techStack: 'Node.js + OpenClaw 运行时',
      },
      {
        id: 'maxClaw',
        name: 'MaxClaw',
        icon: '⚡',
        tag: '云端',
        vendor: 'MiniMax',
        github: 'https://github.com/minimaxi/maxclaw',
        docs: 'https://openclaw.dev/docs/cloud/maxclaw',
        description: '成本杀手，部署成本仅为 Claude 3.5 的 1/10，10 秒极速部署。',
        features: [
          '部署成本仅为 Claude 3.5 的 1/10',
          '10 秒极速部署',
        ],
        techStack: 'Node.js + OpenClaw 运行时',
      },
      {
        id: 'coPaw',
        name: 'CoPaw',
        icon: '🅰️',
        tag: '云端',
        vendor: '阿里云',
        github: 'https://github.com/aliyun/copaw',
        docs: 'https://openclaw.dev/docs/cloud/copaw',
        description: '轻量应用服务器预装镜像，计算巢一键部署，30 分钟内完成部署。',
        features: [
          '轻量应用服务器预装镜像',
          '计算巢一键部署',
          '30 分钟内完成部署',
        ],
        techStack: 'Node.js + OpenClaw 运行时',
      },
    ],
  },
  {
    id: 'opensource',
    label: '🆓 开源新锐',
    tools: [
      {
        id: 'nullClaw',
        name: 'NullClaw',
        icon: '📐',
        tag: '轻量',
        language: 'Zig',
        size: '678KB',
        github: 'https://github.com/nickel-iron/nullclaw',
        description: '极致轻量，编译产物仅 678KB，零依赖，适合嵌入式和资源受限场景。',
        features: [
          '编译产物仅 678KB',
          '零依赖',
          '适合嵌入式和资源受限场景',
        ],
      },
      {
        id: 'openFang',
        name: 'OpenFang',
        icon: '🦀',
        tag: '生产级',
        language: 'Rust',
        github: 'https://github.com/open-fang/openfang',
        description: '生产级 Agent OS，Rust 内存安全保证，高性能运行时。',
        features: [
          'Rust 内存安全保证',
          '高性能运行时',
          '生产级 Agent OS',
        ],
      },
      {
        id: 'easyClaw',
        name: 'EasyClaw',
        icon: '🟢',
        tag: '入门',
        github: 'https://github.com/openclaw/easyclaw',
        docs: 'https://openclaw.dev/docs/frameworks/easyclaw',
        description: '新兴轻量方案，上手门槛低，适合入门用户。',
        features: [
          '上手门槛低',
          '适合入门用户',
          '轻量方案',
        ],
      },
    ],
  },
  {
    id: 'frameworks',
    label: '🏗️ 原生框架',
    tools: [
      {
        id: 'nanobot',
        name: 'Nanobot',
        icon: '🤖',
        language: 'Python',
        vendor: '香港大学 HKUDS',
        website: 'https://github.com/HKUDS/nanobot',
        github: 'https://github.com/HKUDS/nanobot',
        stars: '21.2K',
        description: '核心代码仅约 4000 行（比 OpenClaw 小 99%），复刻几乎所有核心智能体功能。内置 Qwen3 模型，支持网页搜索、定时任务、记忆机制。',
        features: [
          '核心代码仅约 4000 行（比 OpenClaw 小 99%）',
          '内置 Qwen3-4B-Instruct 模型',
          '支持网页搜索、文件/代码操作',
          '定时任务、记忆机制',
          '7×24 实时市场分析',
        ],
        installMethods: [
          { name: 'pip', command: 'pip install nanobot-ai' },
          { name: 'uv', command: 'uv tool install nanobot-ai' },
        ],
      },
      {
        id: 'nanoClaw',
        name: 'NanoClaw',
        icon: '🐳',
        language: 'TypeScript',
        website: 'https://nanoclaw.dev/',
        github: 'https://github.com/qwibitai/nanoclaw',
        size: '28MB',
        description: '多 Agent 协作，Docker/K8s 原生容器隔离，源码仅 15 个核心文件。启动 0.8 秒，内存 28MB（OpenClaw 为 4.2 秒/320MB）。',
        features: [
          '多 Agent 协作',
          'Docker/Kubernetes 原生容器隔离',
          '源码仅 15 个核心文件',
          '代码即配置，零配置文件',
          '内置长短期记忆模块',
          '启动 0.8 秒，内存 28MB',
        ],
      },
      {
        id: 'ironClaw',
        name: 'IronClaw',
        icon: '🛡️',
        tag: '安全',
        github: 'https://github.com/openclaw/ironclaw',
        docs: 'https://openclaw.dev/docs/frameworks/ironclaw',
        description: '安全沙箱强制隔离，所有操作锁死在沙箱里，工具调用出错也不会波及宿主机。适合企业合规和安全敏感场景。',
        features: [
          '安全沙箱强制隔离',
          '工具调用出错不会波及宿主机',
          '适合企业合规和安全敏感场景',
        ],
      },
      {
        id: 'zeroClaw',
        name: 'ZeroClaw',
        icon: '⬡',
        language: 'Rust',
        github: 'https://github.com/openclaw/zeroclaw',
        docs: 'https://openclaw.dev/docs/frameworks/zeroclaw',
        description: 'Rust 重写，极致性能。冷启动 < 10ms，内存占用极低，可运行在树莓派等边缘设备上。',
        features: [
          'Rust 重写，极致性能',
          '冷启动 < 10ms',
          '内存占用极低',
          '可运行在树莓派等边缘设备',
        ],
      },
      {
        id: 'picoClaw',
        name: 'PicoClaw',
        icon: '🐧',
        language: 'Go',
        vendor: 'Sipeed（矽速科技）',
        size: '7.2MB',
        github: 'https://github.com/sipeed/picoclaw',
        docs: 'https://openclaw.dev/docs/frameworks/picoclaw',
        description: '整个框架仅 7.2MB，支持单文件部署，能在 10 元 RISC-V 开发板上运行，内存 < 10MB。',
        features: [
          '打包仅 7.2MB',
          '支持单文件部署',
          '能在 10 元 RISC-V 开发板上运行',
          '内存 < 10MB',
          '适配树莓派、Jetson Nano',
        ],
      },
      {
        id: 'tinyClaw',
        name: 'TinyClaw',
        icon: '👥',
        tag: '协作',
        github: 'https://github.com/openclaw/tinyclaw',
        docs: 'https://openclaw.dev/docs/frameworks/tinyclaw',
        description: '团队管理/协作特化，适合多 Agent 协同办公场景。',
        features: [
          '团队管理/协作特化',
          '多 Agent 协同办公',
        ],
      },
    ],
  },
  {
    id: 'chinese',
    label: '🇨🇳 中文本地化',
    tools: [
      {
        id: 'openclawChinese',
        name: 'OpenClawChinese',
        icon: '🀄',
        github: 'https://github.com/openclaw/openclaw-chinese',
        docs: 'https://openclaw.dev/docs/community/chinese',
        description: 'OpenClaw 中文汉化版，TypeScript 汉化，针对中文用户友好。',
        features: [
          'TypeScript 汉化',
          '中文 UI 全面适配',
        ],
      },
      {
        id: 'lobsterAI',
        name: 'LobsterAI',
        icon: '🦞',
        tag: '网易',
        vendor: '网易',
        website: 'https://lobsterai.163.com',
        docs: 'https://openclaw.dev/docs/community/lobsterai',
        description: '网易出品，本土化优化，针对中文用户友好。',
        features: [
          '网易出品',
          '本土化优化',
        ],
      },
    ],
  },
  {
    id: 'bigtech',
    label: '🏢 大厂布局',
    tools: [
      {
        id: 'arkClaw',
        name: 'ArkClaw',
        icon: '🔱',
        vendor: '字节跳动（火山引擎）',
        website: 'https://www.volcengine.com/product/claw',
        docs: 'https://www.volcengine.com/docs/claw',
        description: '火山引擎上线的 Claw 服务。',
        features: ['火山引擎 Claw 服务'],
      },
      {
        id: 'clawPhone',
        name: 'ClawPhone',
        icon: '📱',
        vendor: '字节跳动',
        website: 'https://www.doubao.com/clawphone',
        docs: 'https://openclaw.dev/docs/bigtech/clawphone',
        description: '端侧 AI 智能体。',
        features: ['端侧 AI 智能体'],
      },
      {
        id: 'baiduClaw',
        name: '百度智能云 OpenClaw',
        icon: '📘',
        vendor: '百度',
        website: 'https://cloud.baidu.com/product/openclaw',
        docs: 'https://cloud.baidu.com/doc/OpenClaw/s/overview',
        description: '云端部署服务，提供算力到模型全方位支持。',
        features: ['算力到模型全方位支持'],
      },
      {
        id: 'ucloudClaw',
        name: '优刻得 OpenClaw',
        icon: '☁️',
        vendor: '优刻得(UCloud)',
        website: 'https://www.ucloud.cn/site/product/openclaw',
        docs: 'https://openclaw.dev/docs/bigtech/ucloud',
        description: '行业率先实现云端部署，已上线美/新/日等海外节点。',
        features: [
          '率先实现云端部署',
          '已上线美/新/日等海外节点',
        ],
      },
      {
        id: 'miclaw',
        name: 'Xiaomi miclaw',
        icon: '🤖',
        vendor: '小米',
        github: 'https://github.com/MiCode/miclaw',
        docs: 'https://openclaw.dev/docs/bigtech/miclaw',
        description: '端侧 AI 智能体，默认集成 Kimi、MiniMax、GLM、DeepSeek 等国产模型，5000+ 技能。',
        features: [
          '端侧 AI 智能体',
          '默认集成国产模型（Kimi、MiniMax、GLM、DeepSeek）',
          '5000+ 技能',
        ],
      },
    ],
  },
  {
    id: 'ecosystem',
    label: '🧰 生态工具',
    tools: [
      {
        id: 'clawhub',
        name: 'ClawHub',
        icon: '🏪',
        website: 'https://clawhub.com/skills',
        tag: '市场',
        description: 'OpenClaw 官方技能市场（类似 App Store），700+ 社区技能。与 VirusTotal 合作扫描技能，Gemini 驱动的 Code Insight 自动分析。',
        features: [
          '官方技能市场（类似 App Store）',
          '700+ 社区技能',
          'VirusTotal 安全扫描',
          'Gemini Code Insight 自动分析',
        ],
        installMethods: [
          { name: '安装技能', command: 'npx clawhub@latest install <skill-name>' },
        ],
      },
      {
        id: 'awesomeSkills',
        name: 'awesome-openclaw-skills',
        icon: '📋',
        website: 'https://github.com/VoltAgent/awesome-openclaw-skills',
        github: 'https://github.com/VoltAgent/awesome-openclaw-skills',
        stars: '16.5K',
        description: '社区精选技能列表，133+ 子类目，覆盖编码 Agents、IDE 集成、数据处理、文件管理等。',
        features: [
          '社区精选技能列表',
          '133+ 子类目',
          '覆盖编码 Agents、IDE 集成、数据处理、文件管理',
        ],
      },
      {
        id: 'installer',
        name: 'OpenClawInstaller',
        icon: '📦',
        website: 'https://github.com/miaoxworld/OpenClawInstaller',
        github: 'https://github.com/miaoxworld/OpenClawInstaller',
        stars: '1.3K',
        description: '一键部署工具，30 秒全自动部署 OpenClaw。',
        features: [
          '一键部署',
          '30 秒全自动部署',
        ],
        installMethods: [
          { name: '一键部署', command: 'curl -fsSL https://github.com/miaoxworld/OpenClawInstaller/raw/main/install.sh | sh' },
        ],
      },
    ],
  },
];

// Find tool by id
const allTools = categories.flatMap(c => c.tools);

// Default active tool
const activeToolId = ref<string>('openclaw');

// Category expansion state
const expandedCategoriesInit: Record<string, boolean> = {};
categories.forEach(cat => { expandedCategoriesInit[cat.id] = true; });
const expandedCategories = reactive<Record<string, boolean>>(expandedCategoriesInit);

const toggleCategory = (catId: string) => {
  expandedCategories[catId] = !expandedCategories[catId];
};

const getToolIconClass = (tool: OpenClawTool): string => {
  if (tool.id === 'nanoClaw') return 'tool-icon-invert';
  return '';
};

const getTagType = (tag: string): 'default' | 'primary' | 'info' | 'success' | 'warning' | 'error' => {
  const map: Record<string, 'default' | 'primary' | 'info' | 'success' | 'warning' | 'error'> = {
    '核心': 'primary',
    '云端': 'info',
    '轻量': 'success',
    '生产级': 'warning',
    '入门': 'success',
    '安全': 'error',
    '协作': 'info',
    '市场': 'primary',
  };
  return map[tag] || 'default';
};

const openUrl = (url: string) => {
  window.open(url, '_blank');
};

const copyCommand = async (command: string) => {
  try {
    await navigator.clipboard.writeText(command);
    message.success(t('openClaw.commandCopied'));
  } catch {
    message.error(t('openClaw.copyFailed'));
  }
};
</script>

<style scoped>
.openclaw-panel {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.openclaw-layout {
  border: 1px solid var(--n-border-color);
  border-radius: 8px;
  overflow: hidden;
  display: flex;
  flex-direction: row;
  flex: 1;
  min-height: 0;
  height: calc(100% - 32px);
  margin: 16px;
}

/* Sidebar */
.openclaw-sidebar {
  width: 220px;
  min-width: 220px;
  background-color: var(--n-color-modal);
  border-right: 1px solid var(--n-border-color);
  overflow-y: auto;
  flex-shrink: 0;
  padding: 8px 0;
}

.sidebar-category {
  margin-bottom: 2px;
}

.category-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  cursor: pointer;
  font-size: 12px;
  font-weight: 600;
  color: var(--n-text-color-2);
  user-select: none;
  transition: color 0.2s;
}

.category-header:hover {
  color: var(--n-text-color);
}

.category-arrow {
  display: inline-block;
  transition: transform 0.2s;
  font-size: 10px;
}

.category-arrow.expanded {
  transform: rotate(90deg);
}

.category-label {
  flex: 1;
}

.category-tools {
  overflow: hidden;
}

.tool-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 14px 6px 34px;
  cursor: pointer;
  font-size: 13px;
  color: var(--n-text-color);
  transition: all 0.15s;
  border-left: 2px solid transparent;
}

.tool-item:hover {
  background-color: var(--n-color-hover);
}

.tool-item.active {
  background-color: var(--n-color-hover);
  border-left-color: var(--n-primary-color);
  color: var(--n-primary-color);
}

.tool-icon {
  font-size: 14px;
  line-height: 1;
  flex-shrink: 0;
  width: 18px;
  text-align: center;
}

.tool-icon-invert {
  filter: invert(1);
}

.tool-name {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Content */
.openclaw-content {
  flex: 1;
  overflow-y: auto;
  min-width: 0;
  height: 100%;
}

.tool-detail {
  padding: 20px 24px;
  width: 100%;
  box-sizing: border-box;
}

.detail-header {
  margin-bottom: 16px;
}

.detail-title-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
}

.detail-icon {
  font-size: 24px;
  line-height: 1;
}

.detail-name {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: var(--n-text-color);
}

.detail-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.detail-description {
  margin: 0 0 16px 0;
  font-size: 14px;
  line-height: 1.7;
  color: var(--n-text-color-2);
}

.detail-section {
  margin-bottom: 12px;
}

.section-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--n-text-color);
  margin: 0 0 8px 0;
}

.features-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px 16px;
}

.feature-item {
  display: flex;
  align-items: baseline;
  gap: 8px;
  font-size: 13px;
  color: var(--n-text-color-2);
  line-height: 1.6;
}

.feature-bullet {
  color: var(--n-primary-color);
  font-size: 10px;
  flex-shrink: 0;
}

.links-row {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.tool-link {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--n-text-color, inherit);
  cursor: pointer;
  font-size: 13px;
  border-radius: 4px;
  padding: 4px 8px;
  transition: background-color 0.2s;
  text-decoration: none;
}

.tool-link:hover {
  background-color: rgba(255, 255, 255, 0.06);
}

.tool-link--primary {
  color: #4098fc;
}

.tool-link--primary:hover {
  background-color: rgba(64, 152, 252, 0.08);
}

.link-url {
  color: rgba(255, 255, 255, 0.35);
  font-size: 11px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-left: auto;
  max-width: 260px;
}

.tool-link--primary .link-url {
  color: rgba(64, 152, 252, 0.45);
}

.install-row {
  margin-bottom: 8px;
}

.method-label {
  font-size: 12px;
  color: var(--n-text-color-3);
  margin-bottom: 4px;
}

.install-input {
  font-family: 'Cascadia Code', 'Fira Code', 'Source Code Pro', Menlo, Monaco, 'Courier New', monospace;
  font-size: 12px;
}

/* Collapse transition */
.collapse-enter-active,
.collapse-leave-active {
  transition: all 0.2s ease;
  overflow: hidden;
}

.collapse-enter-from,
.collapse-leave-to {
  max-height: 0;
  opacity: 0;
}

.collapse-enter-to,
.collapse-leave-from {
  max-height: 500px;
  opacity: 1;
}
</style>
