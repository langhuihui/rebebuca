<!--
 * Rebebuca
 * Copyright (C) 2025 rebebuca contributors
 * 
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 -->

<template>
  <div class="website-desktop">
    <n-config-provider :theme="darkTheme" :locale="locale" :date-locale="dateLocale">
      <n-message-provider>
        <WebsiteContentInner
          :current-lang="currentLang"
          :current-version="currentVersion"
          :macos-url="macosUrl"
          :windows-url="windowsUrl"
          @toggle-lang="toggleLang"
        />
      </n-message-provider>
    </n-config-provider>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, reactive, defineComponent, h } from 'vue'
import {
  NConfigProvider, NMessageProvider, NButton, NIcon, NModal, NForm, NFormItem,
  NInput, NInputGroup, NTag, NSelect, NTooltip,
  NRadio, NRadioGroup, NSpace, NDivider, NSwitch,
  darkTheme, zhCN, dateZhCN, useMessage
} from 'naive-ui'
import {
  LogoGithub, LogoApple, LogoWindows, CodeSlashOutline,
  ChevronDownOutline, ChevronForwardOutline, SyncOutline,
  FolderOpenOutline, AddOutline, GitNetworkOutline,
  StarOutline, FolderOutline, SparklesOutline
} from '@vicons/ionicons5'
import { useI18n } from 'vue-i18n'

const { locale: i18nLocale } = useI18n()

// Theme & Language
const currentLang = ref(localStorage.getItem('rebebuca-locale') || 'zh-CN')
const locale = computed(() => currentLang.value === 'zh-CN' ? zhCN : null)
const dateLocale = computed(() => currentLang.value === 'zh-CN' ? dateZhCN : null)

// Version & Download URLs
const currentVersion = ref('v0.2.2')
const macosUrl = ref('')
const windowsUrl = ref('')

const toggleLang = () => {
  const newLang = currentLang.value === 'zh-CN' ? 'en' : 'zh-CN'
  currentLang.value = newLang
  localStorage.setItem('rebebuca-locale', newLang)
  i18nLocale.value = newLang
}

const fetchVersion = async () => {
  try {
    const res = await fetch('https://download.m7s.live/rb/latest.json')
    const data = await res.json()
    
    currentVersion.value = `v${data.version}`
    
    // Generate download URLs based on GitHub Actions format
    const version = data.version
    macosUrl.value = `https://download.m7s.live/rb/v${version}/macos/Rebebuca.app.tar.gz`
    windowsUrl.value = `https://download.m7s.live/rb/v${version}/nsis/Rebebuca_${version}_x64-setup.exe`
  } catch (e) {
    console.error('Failed to fetch version:', e)
    // Fallback to GitHub releases page
    macosUrl.value = 'https://github.com/langhuihui/rebebuca/releases/latest'
    windowsUrl.value = 'https://github.com/langhuihui/rebebuca/releases/latest'
  }
}

onMounted(() => {
  fetchVersion()
  i18nLocale.value = currentLang.value
})

// Inner component that uses useMessage inside NMessageProvider
const WebsiteContentInner = defineComponent({
  name: 'WebsiteContentInner',
  props: {
    currentLang: String,
    currentVersion: String,
    macosUrl: String,
    windowsUrl: String
  },
  emits: ['toggle-lang'],
  setup(props, { emit }) {
    const { t } = useI18n()
    const message = useMessage()

    // Tab state
    interface TabItem {
      id: string
      name: string
      type: 'features' | 'tech' | 'monibuca' | 'jessibuca'
      isTerminal?: boolean
    }
    const tabs = ref<TabItem[]>([])
    const activeTab = ref<string | null>(null)

    // Groups expand state
    const expandedGroups = reactive({
      favorites: true,
      folder: true,
      npm: true
    })

    const toggleGroup = (group: keyof typeof expandedGroups) => {
      expandedGroups[group] = !expandedGroups[group]
    }

    // Demo Tasks
    interface DemoTask {
      id: string
      name: string
      icon: string
      action?: string
    }

    const favoriteTasks = computed(() => [
      { id: 'info', name: t('website.tasks.viewFeatures'), icon: '✨', action: 'features' },
      { id: 'tech', name: t('website.tasks.viewTech'), icon: '⚙️', action: 'tech' },
      { id: 'monibuca', name: 'Monibuca', icon: '🎬', action: 'monibuca' },
      { id: 'jessibuca', name: 'Jessibuca', icon: '📺', action: 'jessibuca' },
    ])

    const npmTasks = ref<DemoTask[]>([
      { id: 'npm-dev', name: 'dev', icon: '▶️', action: 'run' },
      { id: 'npm-build', name: 'build', icon: '📦', action: 'run' },
      { id: 'npm-preview', name: 'preview', icon: '👁️', action: 'run' },
      { id: 'npm-lint', name: 'lint', icon: '🔍', action: 'run' },
      { id: 'npm-tauri', name: 'tauri dev', icon: '🦀', action: 'run' },
    ])

    // Running state
    const runningTaskId = ref<string | null>(null)

    // Dialog states
    const showTaskEditDialog = ref(false)
    const showAddFolderDialog = ref(false)
    const showAIDialog = ref(false)
    const showPortDialog = ref(false)

    // Add Folder Dialog form
    const addFolderForm = reactive({
      sourceFolder: '',
      isImportMode: false,
      targetGroupId: 'default',
      newGroupName: ''
    })

    // Task Edit Dialog form (matches real TaskEditDialog)
    const taskEditForm = reactive({
      name: '',
      command: '',
      cwd: '',
      envStr: '',
      useSystemTerminal: false,
      groupId: 'default'
    })

    // AI Dialog form
    const aiForm = reactive({
      provider: 'ollama' as string,
      apiKey: '',
      ollamaUrl: 'http://localhost:11434',
      ollamaModel: 'qwen2.5:3b',
      prompt: '',
      loading: false,
      result: null as any,
      error: ''
    })

    const aiProviderOptions = [
      { label: 'Ollama (本地)', value: 'ollama' },
      { label: 'OpenAI (GPT-4)', value: 'openai' },
      { label: 'Anthropic (Claude)', value: 'anthropic' },
      { label: 'DeepSeek', value: 'deepseek' },
    ]

    const ollamaModelOptions = [
      { label: 'Qwen2.5 3B', value: 'qwen2.5:3b' },
      { label: 'Qwen2.5 Coder 3B', value: 'qwen2.5-coder:3b' },
      { label: 'Qwen2.5 7B', value: 'qwen2.5:7b' },
      { label: 'Llama3.2 3B', value: 'llama3.2:3b' },
      { label: 'Phi3 Mini', value: 'phi3:mini' },
      { label: 'Mistral 7B', value: 'mistral:7b' },
    ]

    const groupOptions = [
      { label: t('task.defaultGroup'), value: 'default' },
      { label: t('task.favorites'), value: 'favorites' },
      { label: t('task.createNewGroup'), value: '__new__' },
    ]

    // Demo ports data (grouped by process)
    const demoPortProcesses = ref([
      { pid: 12345, name: 'node', command: 'node server.js', ports: [5173, 5174] },
      { pid: 12346, name: 'tauri', command: 'tauri dev', ports: [1420] },
      { pid: 12347, name: 'nginx', command: 'nginx -g daemon off', ports: [80, 443] },
    ])
    const portFilter = ref('')
    
    const filteredPortProcesses = computed(() => {
      if (!portFilter.value) return demoPortProcesses.value
      const filter = portFilter.value.trim().toLowerCase()
      return demoPortProcesses.value.filter(p => 
        p.ports.some(port => String(port).includes(filter)) ||
        p.name.toLowerCase().includes(filter) ||
        String(p.pid).includes(filter)
      )
    })
    
    const handleKillProcess = (pid: number) => {
      message.success(t('website.demo.processKilled'))
      demoPortProcesses.value = demoPortProcesses.value.filter(p => p.pid !== pid)
    }
    
    const handleRefreshPorts = () => {
      message.info(t('website.demo.portsRefreshed'))
    }

    // Features content for terminal output
    const featuresContent = computed(() => [
      `$ rebebuca --features`,
      ``,
      `Rebebuca - ${t('website.hero.subtitle')}`,
      ``,
      `${t('website.features.quickLaunch.title')}`,
      `  ${t('website.features.quickLaunch.desc')}`,
      ``,
      `${t('website.features.realtime.title')}`,
      `  ${t('website.features.realtime.desc')}`,
      ``,
      `${t('website.features.config.title')}`,
      `  ${t('website.features.config.desc')}`,
      ``,
      `${t('website.features.ui.title')}`,
      `  ${t('website.features.ui.desc')}`,
      ``,
      `[Done] Process exited with code 0`,
    ])

    const techContent = computed(() => [
      `$ rebebuca --tech-stack`,
      ``,
      `Tech Stack:`,
      ``,
      `  Frontend:`,
      `    - Vue 3.5 (Composition API)`,
      `    - TypeScript 5.6`,
      `    - Vite 6.0`,
      `    - Naive UI`,
      `    - Xterm.js`,
      ``,
      `  Backend:`,
      `    - Tauri 2.0 (Rust)`,
      `    - tokio (async runtime)`,
      `    - portable-pty`,
      ``,
      `  Features:`,
      `    - Multi-platform (macOS, Windows, Linux)`,
      `    - Native performance`,
      `    - Small bundle size (~15MB)`,
      `    - AI task generation (Ollama, OpenAI, Claude)`,
      ``,
      `[Done] Process exited with code 0`,
    ])

    const monibucaContent = computed(() => [
      `$ open https://monibuca.com`,
      ``,
      `Monibuca - ${t('website.monibuca.title')}`,
      ``,
      `${t('website.monibuca.desc')}`,
      ``,
      `${t('website.monibuca.features')}:`,
      `  - ${t('website.monibuca.feature1')}`,
      `  - ${t('website.monibuca.feature2')}`,
      `  - ${t('website.monibuca.feature3')}`,
      `  - ${t('website.monibuca.feature4')}`,
      ``,
      `Website: https://monibuca.com`,
      `GitHub: https://github.com/langhuihui/monibuca`,
      ``,
      `[Done] Process exited with code 0`,
    ])

    const jessibucaContent = computed(() => [
      `$ open https://jessibuca.com`,
      ``,
      `Jessibuca - ${t('website.jessibuca.title')}`,
      ``,
      `${t('website.jessibuca.desc')}`,
      ``,
      `${t('website.jessibuca.features')}:`,
      `  - ${t('website.jessibuca.feature1')}`,
      `  - ${t('website.jessibuca.feature2')}`,
      `  - ${t('website.jessibuca.feature3')}`,
      `  - ${t('website.jessibuca.feature4')}`,
      ``,
      `Website: https://jessibuca.com`,
      `GitHub: https://github.com/langhuihui/jessibuca`,
      ``,
      `[Done] Process exited with code 0`,
    ])

    const handleAddFolder = () => {
      message.success(t('website.demo.folderAdded'))
      showAddFolderDialog.value = false
      addFolderForm.sourceFolder = ''
      addFolderForm.isImportMode = false
    }

    const handleAddTask = () => {
      message.success(t('website.demo.taskAdded'))
      showTaskEditDialog.value = false
      taskEditForm.name = ''
      taskEditForm.command = ''
      taskEditForm.cwd = ''
      taskEditForm.envStr = ''
      taskEditForm.useSystemTerminal = false
    }

    const handleAIGenerate = async () => {
      if (!aiForm.prompt) {
        message.warning(t('website.demo.aiPromptRequired'))
        return
      }
      
      aiForm.loading = true
      aiForm.error = ''
      aiForm.result = null
      
      await new Promise(r => setTimeout(r, 1500))
      
      aiForm.result = {
        name: 'Generated Task',
        command: 'node',
        args: ['server.js'],
        cwd: './src'
      }
      
      aiForm.loading = false
      message.success(t('website.demo.aiGenerated'))
    }

    const openTab = (id: string, name: string, type: 'features' | 'tech' | 'monibuca' | 'jessibuca') => {
      const existingTab = tabs.value.find(t => t.id === id)
      if (existingTab) {
        activeTab.value = id
        return
      }
      tabs.value.push({ id, name, type, isTerminal: true })
      activeTab.value = id
    }

    const closeTab = (id: string) => {
      const index = tabs.value.findIndex(t => t.id === id)
      if (index !== -1) {
        tabs.value.splice(index, 1)
        if (activeTab.value === id) {
          activeTab.value = tabs.value.length > 0 ? tabs.value[tabs.value.length - 1].id : null
        }
      }
    }

    // Get tab content dynamically based on type
    const getTabContent = (type: 'features' | 'tech' | 'monibuca' | 'jessibuca') => {
      switch (type) {
        case 'features': return featuresContent.value
        case 'tech': return techContent.value
        case 'monibuca': return monibucaContent.value
        case 'jessibuca': return jessibucaContent.value
      }
    }

    const runDemoTask = async (task: DemoTask) => {
      if (runningTaskId.value) return
      
      runningTaskId.value = task.id
      await new Promise(r => setTimeout(r, 800))
      runningTaskId.value = null
      
      if (task.action === 'features') {
        openTab('features', t('website.tasks.viewFeatures'), 'features')
      } else if (task.action === 'tech') {
        openTab('tech', t('website.tasks.viewTech'), 'tech')
      } else if (task.action === 'monibuca') {
        openTab('monibuca', 'Monibuca', 'monibuca')
      } else if (task.action === 'jessibuca') {
        openTab('jessibuca', 'Jessibuca', 'jessibuca')
      } else {
        message.success(`${task.name} ${t('website.demo.completed')}`)
      }
    }

    // Render terminal content
    const renderTerminalContent = (content: string[]) => {
      return h('div', { class: 'terminal-output' }, 
        content.map((line, i) => h('div', { 
          key: i, 
          class: ['terminal-line', { 'terminal-command': line.startsWith('$'), 'terminal-done': line.startsWith('[Done]') }]
        }, line || '\u00A0'))
      )
    }

    return () => h('div', { class: 'website-app' }, [
      // Navbar
      h('header', { class: 'website-navbar' }, [
        h('div', { class: 'navbar-left' }, [
          h('img', { src: '/text.svg', alt: 'Rebebuca', class: 'navbar-text' }),
          h('span', { class: 'navbar-version' }, props.currentVersion)
        ]),
        h('div', { class: 'navbar-center' }, [
          h('span', { class: 'navbar-title' }, t('website.hero.title'))
        ]),
        h('div', { class: 'navbar-right' }, [
          h(NButton, { quaternary: true, size: 'small', onClick: () => emit('toggle-lang') }, 
            () => props.currentLang === 'zh-CN' ? 'EN' : '中'),
          h(NButton, { quaternary: true, circle: true, size: 'small', tag: 'a', href: 'https://github.com/langhuihui/rebebuca', target: '_blank' },
            { icon: () => h(NIcon, null, () => h(LogoGithub)) })
        ])
      ]),
      
      // Main Content
      h('div', { class: 'website-main' }, [
        // Sidebar
        h('aside', { class: 'website-sidebar' }, [
          h('div', { class: 'sidebar-header' }, [
            h('img', { src: '/logo-dark.svg', alt: 'Rebebuca', class: 'sidebar-logo' }),
            h('div', { class: 'header-buttons' }, [
              h(NTooltip, { trigger: 'hover' }, {
                trigger: () => h(NButton, { size: 'small', quaternary: true, onClick: () => showAddFolderDialog.value = true },
                  { icon: () => h(NIcon, null, () => h(FolderOpenOutline)) }),
                default: () => t('task.addFolder')
              }),
              h(NTooltip, { trigger: 'hover' }, {
                trigger: () => h(NButton, { size: 'small', quaternary: true, onClick: () => showTaskEditDialog.value = true },
                  { icon: () => h(NIcon, null, () => h(AddOutline)) }),
                default: () => t('task.addTask')
              }),
              h(NTooltip, { trigger: 'hover' }, {
                trigger: () => h(NButton, { size: 'small', quaternary: true, onClick: () => showAIDialog.value = true },
                  { icon: () => h(NIcon, null, () => h(SparklesOutline)) }),
                default: () => t('task.aiGenerate')
              }),
              h(NTooltip, { trigger: 'hover' }, {
                trigger: () => h(NButton, { size: 'small', quaternary: true, onClick: () => showPortDialog.value = true },
                  { icon: () => h(NIcon, null, () => h(GitNetworkOutline)) }),
                default: () => t('task.portManagement')
              })
            ])
          ]),
          h('div', { class: 'task-list' }, [
            // Favorites Section
            h('div', { class: 'task-group' }, [
              h('div', { class: 'group-header', onClick: () => toggleGroup('favorites') }, [
                h(NIcon, { class: 'group-icon' }, () => expandedGroups.favorites ? h(ChevronDownOutline) : h(ChevronForwardOutline)),
                h(NIcon, { class: 'group-type-icon star' }, () => h(StarOutline)),
                h('span', { class: 'group-name' }, t('task.favorites')),
                h('span', { class: 'group-count' }, favoriteTasks.value.length)
              ]),
              expandedGroups.favorites && h('div', { class: 'group-tasks' },
                favoriteTasks.value.map(task => h('div', {
                  key: task.id,
                  class: ['task-item', { running: runningTaskId.value === task.id }],
                  onClick: () => runDemoTask(task)
                }, [
                  h('span', { class: 'task-icon' }, task.icon),
                  h('span', { class: 'task-name' }, task.name),
                  runningTaskId.value === task.id && h(NIcon, { class: 'task-spinner' }, () => h(SyncOutline))
                ]))
              )
            ]),
            // Folder Section
            h('div', { class: 'task-group' }, [
              h('div', { class: 'group-header', onClick: () => toggleGroup('folder') }, [
                h(NIcon, { class: 'group-icon' }, () => expandedGroups.folder ? h(ChevronDownOutline) : h(ChevronForwardOutline)),
                h(NIcon, { class: 'group-type-icon folder' }, () => h(FolderOutline)),
                h('span', { class: 'group-name' }, '~/projects/rebebuca')
              ]),
              expandedGroups.folder && h('div', { class: 'group-tasks' }, [
                h('div', { class: 'source-header', onClick: () => toggleGroup('npm') }, [
                  h(NIcon, { class: 'group-icon' }, () => expandedGroups.npm ? h(ChevronDownOutline) : h(ChevronForwardOutline)),
                  h('span', { class: 'source-icon' }, '📦'),
                  h('span', { class: 'source-name' }, 'package.json'),
                  h('span', { class: 'group-count' }, npmTasks.value.length)
                ]),
                expandedGroups.npm && h('div', { class: 'source-tasks' },
                  npmTasks.value.map(task => h('div', {
                    key: task.id,
                    class: ['task-item', 'source-task', { running: runningTaskId.value === task.id }],
                    onClick: () => runDemoTask(task)
                  }, [
                    h('span', { class: 'task-icon' }, task.icon),
                    h('span', { class: 'task-name' }, task.name),
                    runningTaskId.value === task.id && h(NIcon, { class: 'task-spinner' }, () => h(SyncOutline))
                  ]))
                )
              ])
            ])
          ])
        ]),
        
        // Main Content Area
        h('main', { class: 'website-content' }, [
          // Tabs bar
          tabs.value.length > 0 && h('div', { class: 'tabs-bar' },
            tabs.value.map(tab => h('div', {
              key: tab.id,
              class: ['tab-item', { active: activeTab.value === tab.id }],
              onClick: () => activeTab.value = tab.id
            }, [
              h('span', { class: 'tab-name' }, tab.name),
              h('span', { class: 'tab-close', onClick: (e: Event) => { e.stopPropagation(); closeTab(tab.id) } }, '×')
            ]))
          ),
          
          // Tab content or Welcome screen
          activeTab.value && tabs.value.find(t => t.id === activeTab.value)
            ? h('div', { class: 'tab-content' }, [
                renderTerminalContent(getTabContent(tabs.value.find(t => t.id === activeTab.value)!.type))
              ])
            : h('div', { class: 'welcome-container' }, [
                h('div', { class: 'welcome-content' }, [
                  h('img', { src: '/logo-dark.svg', alt: 'Rebebuca', class: 'welcome-logo' }),
                  h('h1', { class: 'welcome-title' }, t('website.hero.title')),
                  h('p', { class: 'welcome-subtitle' }, t('website.hero.subtitle')),
                  
                  // Download Section
                  h('div', { class: 'download-section' }, [
                    h('h2', { class: 'download-title' }, t('website.download.title')),
                    h('div', { class: 'download-buttons' }, [
                      h('a', { href: props.macosUrl || 'https://github.com/langhuihui/rebebuca/releases/latest', target: '_blank', class: 'download-btn macos' }, [
                        h(NIcon, { size: 32 }, () => h(LogoApple)),
                        h('div', { class: 'download-info' }, [
                          h('span', { class: 'download-platform' }, 'macOS'),
                          h('span', { class: 'download-arch' }, 'Apple Silicon / Intel')
                        ])
                      ]),
                      h('a', { href: props.windowsUrl || 'https://github.com/langhuihui/rebebuca/releases/latest', target: '_blank', class: 'download-btn windows' }, [
                        h(NIcon, { size: 32 }, () => h(LogoWindows)),
                        h('div', { class: 'download-info' }, [
                          h('span', { class: 'download-platform' }, 'Windows'),
                          h('span', { class: 'download-arch' }, 'x64')
                        ])
                      ]),
                      h('a', { href: 'https://github.com/langhuihui/rebebuca/releases/latest', target: '_blank', class: 'download-btn linux' }, [
                        h('svg', { class: 'linux-icon', viewBox: '0 0 24 24', fill: 'currentColor', innerHTML: '<path d="M12.504 0c-.155 0-.315.008-.48.021-4.226.333-3.105 4.807-3.17 6.298-.076 1.092-.3 1.953-1.05 3.02-.885 1.051-2.127 2.75-2.716 4.521-.278.832-.41 1.684-.287 2.489a.424.424 0 00-.11.135c-.26.268-.45.6-.663.839-.199.199-.485.267-.797.4-.313.136-.658.269-.864.68-.09.189-.136.394-.132.602 0 .199.027.4.055.536.058.399.116.728.04.97-.249.68-.28 1.145-.106 1.484.174.334.535.47.94.601.81.2 1.91.135 2.774.6.926.466 1.866.67 2.616.47.526-.116.97-.464 1.208-.946.587-.003 1.23-.269 2.26-.334.699-.058 1.574.267 2.577.2.025.134.063.198.114.333l.003.003c.391.778 1.113 1.132 1.884 1.071.771-.06 1.592-.536 2.257-1.306.631-.765 1.683-1.084 2.378-1.503.348-.199.629-.469.649-.853.023-.4-.2-.811-.714-1.376v-.097l-.003-.003c-.17-.2-.25-.535-.338-.926-.085-.401-.182-.786-.492-1.046h-.003c-.059-.054-.123-.067-.188-.135a.357.357 0 00-.19-.064c.431-1.278.264-2.55-.173-3.694-.533-1.41-1.465-2.638-2.175-3.483-.796-1.005-1.576-1.957-1.56-3.368.026-2.152.236-6.133-3.544-6.139z"/>' }),
                        h('div', { class: 'download-info' }, [
                          h('span', { class: 'download-platform' }, 'Linux'),
                          h('span', { class: 'download-arch' }, 'AppImage / deb')
                        ])
                      ])
                    ]),
                    h('p', { class: 'download-hint' }, [
                      h(NIcon, null, () => h(LogoGithub)),
                      t('website.download.note')
                    ]),
                    h('div', { class: 'security-warning' }, [
                      h('p', null, '⚠️ ' + t('website.download.securityWarning')),
                      h('ul', null, [
                        h('li', null, 'Windows: ' + t('website.download.windowsWarning')),
                        h('li', null, 'macOS: ' + t('website.download.macosWarning'))
                      ])
                    ])
                  ])
                ])
              ])
        ])
      ]),
      
      // Status Bar
      h('footer', { class: 'website-statusbar' }, [
        h('div', { class: 'statusbar-left' }, [
          h('span', { class: 'status-item' }, [
            h(NIcon, null, () => h(CodeSlashOutline)),
            'Vue 3 + TypeScript + Tauri'
          ])
        ]),
        h('div', { class: 'statusbar-center' }, [
          h('span', { class: 'status-item demo-notice' }, t('website.status.demoNotice'))
        ]),
        h('div', { class: 'statusbar-right' }, [
          h('a', { href: 'https://github.com/langhuihui/rebebuca', target: '_blank', class: 'status-item clickable' }, [
            h(NIcon, null, () => h(LogoGithub)),
            'GitHub'
          ]),
          h('span', { class: 'status-item' }, 'GPL-3.0')
        ])
      ]),
      
      // Add Folder Dialog
      h(NModal, { 
        show: showAddFolderDialog.value, 
        'onUpdate:show': (v: boolean) => showAddFolderDialog.value = v, 
        preset: 'dialog', 
        title: t('task.addFolder'), 
        style: 'width: 520px;',
        positiveText: addFolderForm.isImportMode ? t('task.scanTasks') : t('common.confirm'),
        negativeText: t('common.cancel'),
        onPositiveClick: handleAddFolder
      }, {
        default: () => h(NForm, { labelPlacement: 'top' }, () => [
          h(NFormItem, { label: t('task.selectFolder') }, () => 
            h(NInputGroup, null, () => [
              h(NInput, { value: addFolderForm.sourceFolder, 'onUpdate:value': (v: string) => addFolderForm.sourceFolder = v, placeholder: t('task.selectSourceFolder'), clearable: true }),
              h(NButton, { onClick: () => { addFolderForm.sourceFolder = '/Users/demo/projects'; message.info(t('website.demo.folderHint')) } }, () => t('task.browse'))
            ])
          ),
          h(NFormItem, { label: t('task.addFolderMode') }, () =>
            h(NRadioGroup, { value: addFolderForm.isImportMode, 'onUpdate:value': (v: boolean) => addFolderForm.isImportMode = v }, () =>
              h(NSpace, { vertical: true }, () => [
                h(NRadio, { value: false }, () => 
                  h('div', { class: 'mode-option' }, [
                    h('span', { class: 'mode-title' }, t('task.modeOpen')),
                    h('span', { class: 'mode-desc' }, t('task.modeOpenDesc'))
                  ])
                ),
                h(NRadio, { value: true }, () =>
                  h('div', { class: 'mode-option' }, [
                    h('span', { class: 'mode-title' }, t('task.modeImport')),
                    h('span', { class: 'mode-desc' }, t('task.modeImportDesc'))
                  ])
                )
              ])
            )
          ),
          addFolderForm.isImportMode && h(NFormItem, { label: t('task.targetGroup') }, () =>
            h(NSelect, { value: addFolderForm.targetGroupId, 'onUpdate:value': (v: string) => addFolderForm.targetGroupId = v, options: groupOptions })
          ),
          addFolderForm.isImportMode && addFolderForm.targetGroupId === '__new__' && h(NFormItem, { label: t('task.newGroupName') }, () =>
            h(NInput, { value: addFolderForm.newGroupName, 'onUpdate:value': (v: string) => addFolderForm.newGroupName = v, placeholder: t('task.newGroupPlaceholder') })
          )
        ])
      }),
      
      // Task Edit Dialog (matches real TaskEditDialog)
      h(NModal, { 
        show: showTaskEditDialog.value, 
        'onUpdate:show': (v: boolean) => showTaskEditDialog.value = v, 
        preset: 'dialog', 
        title: t('task.addTask'), 
        style: 'width: 500px;',
        positiveText: t('common.save'),
        negativeText: t('common.cancel'),
        onPositiveClick: handleAddTask
      }, {
        default: () => h(NForm, { labelPlacement: 'left', labelWidth: 'auto' }, () => [
          h(NFormItem, { label: t('task.name') }, () => 
            h(NInput, { value: taskEditForm.name, 'onUpdate:value': (v: string) => taskEditForm.name = v, placeholder: t('task.namePlaceholder') })
          ),
          h(NFormItem, { label: t('task.command') }, () => 
            h(NInput, { 
              value: taskEditForm.command, 
              'onUpdate:value': (v: string) => taskEditForm.command = v, 
              type: 'textarea',
              placeholder: t('task.commandPlaceholder'),
              autosize: { minRows: 1, maxRows: 5 }
            })
          ),
          h(NFormItem, { label: t('task.cwd') }, () =>
            h(NInputGroup, null, () => [
              h(NInput, { value: taskEditForm.cwd, 'onUpdate:value': (v: string) => taskEditForm.cwd = v, placeholder: t('task.cwdPlaceholder') }),
              h(NButton, { onClick: () => { taskEditForm.cwd = '/Users/demo/projects'; message.info(t('website.demo.folderHint')) } }, () => t('task.browse'))
            ])
          ),
          h(NFormItem, { label: t('task.env') }, () =>
            h(NInput, { 
              value: taskEditForm.envStr, 
              'onUpdate:value': (v: string) => taskEditForm.envStr = v, 
              type: 'textarea',
              placeholder: t('task.envPlaceholder'),
              autosize: { minRows: 2, maxRows: 10 }
            })
          ),
          h(NFormItem, { label: t('task.useSystemTerminal') }, () =>
            h(NSwitch, { value: taskEditForm.useSystemTerminal, 'onUpdate:value': (v: boolean) => taskEditForm.useSystemTerminal = v })
          ),
          h(NFormItem, { label: t('task.group') }, () =>
            h(NSelect, { value: taskEditForm.groupId, 'onUpdate:value': (v: string) => taskEditForm.groupId = v, options: groupOptions })
          )
        ])
      }),
      
      // AI Generate Dialog
      h(NModal, { 
        show: showAIDialog.value, 
        'onUpdate:show': (v: boolean) => showAIDialog.value = v, 
        preset: 'dialog', 
        title: t('task.aiGenerate'), 
        style: 'width: 600px;',
        showIcon: false
      }, {
        default: () => h('div', { class: 'ai-dialog-content' }, [
          h(NFormItem, { label: t('task.aiProvider') }, () =>
            h(NSelect, { value: aiForm.provider, 'onUpdate:value': (v: string) => aiForm.provider = v, options: aiProviderOptions })
          ),
          aiForm.provider === 'ollama' && [
            h(NFormItem, { label: t('task.ollamaUrl') }, () =>
              h(NInput, { value: aiForm.ollamaUrl, 'onUpdate:value': (v: string) => aiForm.ollamaUrl = v, placeholder: 'http://localhost:11434' })
            ),
            h(NFormItem, { label: t('task.ollamaModel') }, () =>
              h(NSelect, { value: aiForm.ollamaModel, 'onUpdate:value': (v: string) => aiForm.ollamaModel = v, options: ollamaModelOptions, filterable: true, tag: true })
            )
          ],
          aiForm.provider !== 'ollama' && h(NFormItem, { label: t('task.aiApiKey') }, () =>
            h(NInput, { value: aiForm.apiKey, 'onUpdate:value': (v: string) => aiForm.apiKey = v, type: 'password', showPasswordOn: 'click', placeholder: t('task.aiApiKeyPlaceholder') })
          ),
          h(NFormItem, { label: t('task.aiPrompt') }, () =>
            h(NInput, { value: aiForm.prompt, 'onUpdate:value': (v: string) => aiForm.prompt = v, type: 'textarea', placeholder: t('task.aiPromptPlaceholder'), autosize: { minRows: 3, maxRows: 6 } })
          ),
          h('div', { class: 'ai-actions' }, [
            h(NButton, { type: 'primary', loading: aiForm.loading, disabled: (aiForm.provider !== 'ollama' && !aiForm.apiKey) || !aiForm.prompt, onClick: handleAIGenerate }, () => t('task.aiGenerateBtn'))
          ]),
          aiForm.result && h('div', { class: 'ai-result' }, [
            h(NDivider, null, () => t('task.aiResult')),
            h('div', { class: 'generated-task' }, [
              h('div', { class: 'result-item' }, [
                h('span', { class: 'result-label' }, `${t('task.name')}:`),
                h('span', { class: 'result-value' }, aiForm.result.name)
              ]),
              h('div', { class: 'result-item' }, [
                h('span', { class: 'result-label' }, `${t('task.command')}:`),
                h('span', { class: 'result-value monospace' }, aiForm.result.command)
              ]),
              aiForm.result.args?.length && h('div', { class: 'result-item' }, [
                h('span', { class: 'result-label' }, `${t('task.args')}:`),
                h('span', { class: 'result-value monospace' }, aiForm.result.args.join(' '))
              ]),
              aiForm.result.cwd && h('div', { class: 'result-item' }, [
                h('span', { class: 'result-label' }, `${t('task.cwd')}:`),
                h('span', { class: 'result-value monospace' }, aiForm.result.cwd)
              ])
            ]),
            h('div', { class: 'ai-result-actions' }, [
              h(NButton, { onClick: () => { message.success(t('website.demo.taskAdded')); showAIDialog.value = false } }, () => t('task.addToTasks')),
              h(NButton, { tertiary: true, onClick: () => { showTaskEditDialog.value = true; showAIDialog.value = false } }, () => t('task.editAndAdd'))
            ])
          ])
        ])
      }),
      
      // Port Management Dialog (matches real PortManagementDialog)
      h(NModal, { 
        show: showPortDialog.value, 
        'onUpdate:show': (v: boolean) => showPortDialog.value = v, 
        preset: 'dialog', 
        title: t('task.portManagement'), 
        style: 'width: 700px;',
        showIcon: false
      }, {
        default: () => h('div', { class: 'port-dialog-content' }, [
          // Filter and Refresh
          h('div', { class: 'port-filter' }, [
            h(NInput, { 
              value: portFilter.value, 
              'onUpdate:value': (v: string) => portFilter.value = v,
              placeholder: t('task.portFilter'),
              clearable: true
            }),
            h(NButton, { type: 'primary', onClick: handleRefreshPorts }, () => t('task.refreshPorts'))
          ]),
          // Port List
          filteredPortProcesses.value.length > 0
            ? h('div', { class: 'port-list' }, [
                h('div', { class: 'port-header' }, [
                  h('span', { class: 'name-col' }, t('task.processName')),
                  h('span', { class: 'pid-col' }, t('task.pid')),
                  h('span', { class: 'port-col' }, t('task.port')),
                  h('span', { class: 'action-col' })
                ]),
                ...filteredPortProcesses.value.map(proc => 
                  h('div', { key: proc.pid, class: 'port-item' }, [
                    h('span', { class: 'name-col', title: proc.command }, proc.name),
                    h('span', { class: 'pid-col' }, proc.pid),
                    h('span', { class: 'port-col port-numbers' }, 
                      proc.ports.map(port => h(NTag, { key: port, size: 'small', type: 'info', class: 'port-tag' }, () => port))
                    ),
                    h('span', { class: 'action-col' }, 
                      h(NButton, { size: 'small', type: 'error', quaternary: true, onClick: () => handleKillProcess(proc.pid) }, () => t('task.killProcess'))
                    )
                  ])
                )
              ])
            : h('div', { class: 'no-ports' }, [
                h('p', null, t('task.noPortsFound'))
              ])
        ])
      })
    ])
  }
})
</script>

<style scoped>
.website-desktop {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px;
  background: linear-gradient(135deg, 
    #0f0c29 0%, 
    #302b63 40%, 
    #24243e 70%,
    #0f0c29 100%
  );
  background-size: 400% 400%;
  animation: gradientShift 15s ease infinite;
  position: relative;
  overflow: hidden;
}

.website-desktop::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: 
    radial-gradient(ellipse at 20% 20%, rgba(120, 100, 255, 0.15) 0%, transparent 50%),
    radial-gradient(ellipse at 80% 80%, rgba(36, 200, 219, 0.12) 0%, transparent 50%),
    radial-gradient(ellipse at 50% 50%, rgba(189, 52, 254, 0.08) 0%, transparent 60%);
  pointer-events: none;
}

@keyframes gradientShift {
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}
</style>

<style>
.website-app {
  display: flex;
  flex-direction: column;
  width: 1100px;
  height: 750px;
  max-width: calc(100vw - 80px);
  max-height: calc(100vh - 80px);
  background: #18181c;
  border-radius: 12px;
  box-shadow: 
    0 25px 80px rgba(0, 0, 0, 0.5),
    0 0 0 1px rgba(255, 255, 255, 0.1),
    inset 0 1px 0 rgba(255, 255, 255, 0.05);
  overflow: hidden;
  position: relative;
  z-index: 1;
}

/* Navbar */
.website-navbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 40px;
  padding: 0 12px;
  background: #252529;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px 12px 0 0;
}

.website-navbar::before {
  content: '';
  display: flex;
  width: 52px;
  height: 12px;
  background: 
    radial-gradient(circle at 6px 6px, #ff5f56 5px, transparent 5px),
    radial-gradient(circle at 26px 6px, #ffbd2e 5px, transparent 5px),
    radial-gradient(circle at 46px 6px, #27c93f 5px, transparent 5px);
  margin-right: 12px;
}

.navbar-left, .navbar-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.navbar-logo {
  width: 20px;
  height: 20px;
}

.navbar-text {
  height: 14px;
  filter: brightness(0) invert(1);
}

.navbar-version {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.5);
  background: rgba(255, 255, 255, 0.1);
  padding: 2px 6px;
  border-radius: 4px;
}

.navbar-center {
  flex: 1;
  display: flex;
  justify-content: center;
}

.navbar-title {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.7);
  font-weight: 500;
}

/* Main Content */
.website-main {
  flex: 1;
  display: flex;
  overflow: hidden;
  background: #18181c;
}

/* Sidebar */
.website-sidebar {
  width: 260px;
  border-right: 1px solid rgba(255, 255, 255, 0.08);
  overflow: hidden;
  background: #1e1e22;
  display: flex;
  flex-direction: column;
}

.sidebar-header {
  padding: 8px 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  display: flex;
  align-items: center;
  gap: 8px;
}

.sidebar-logo {
  width: 24px;
  height: 24px;
}

.header-buttons {
  display: flex;
  gap: 4px;
}

.task-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px 0;
}

.task-group {
  margin-bottom: 4px;
}

.group-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  cursor: pointer;
  transition: background 0.2s;
}

.group-header:hover {
  background: rgba(255, 255, 255, 0.05);
}

.group-icon {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.4);
}

.group-type-icon {
  font-size: 14px;
}

.group-type-icon.recent {
  color: #36cfc9;
}

.group-type-icon.star {
  color: #f5a623;
}

.group-type-icon.folder {
  color: #7c4dff;
}

.group-name {
  flex: 1;
  font-size: 13px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.8);
}

.group-count {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.3);
  background: rgba(255, 255, 255, 0.08);
  padding: 1px 6px;
  border-radius: 10px;
}

.group-tasks {
  padding: 2px 0;
}

.source-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px 6px 28px;
  cursor: pointer;
  transition: background 0.2s;
}

.source-header:hover {
  background: rgba(255, 255, 255, 0.05);
}

.source-icon {
  font-size: 14px;
}

.source-name {
  flex: 1;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.7);
}

.source-tasks {
  padding: 2px 0;
}

.task-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px 8px 28px;
  cursor: pointer;
  transition: all 0.2s;
  text-decoration: none;
  color: inherit;
}

.task-item.source-task {
  padding-left: 44px;
}

.task-item:hover {
  background: rgba(255, 255, 255, 0.05);
}

.task-item.running {
  background: rgba(36, 200, 219, 0.15);
}

.task-icon {
  font-size: 14px;
}

.task-name {
  flex: 1;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.8);
}

.task-spinner {
  font-size: 14px;
  color: #24c8db;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* Content Area */
.website-content {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

/* Tabs */
.tabs-bar {
  display: flex;
  background: #252529;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  min-height: 32px;
}

.tab-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.6);
  cursor: pointer;
  border-right: 1px solid rgba(255, 255, 255, 0.08);
  transition: all 0.2s;
}

.tab-item:hover {
  background: rgba(255, 255, 255, 0.05);
}

.tab-item.active {
  background: #18181c;
  color: #fff;
}

.tab-close {
  font-size: 14px;
  opacity: 0.5;
  cursor: pointer;
  line-height: 1;
}

.tab-close:hover {
  opacity: 1;
}

.tab-content {
  flex: 1;
  overflow: auto;
  background: #0d0d0f;
}

/* Terminal Output */
.terminal-output {
  padding: 16px;
  font-family: 'SF Mono', 'Monaco', 'Menlo', 'Consolas', monospace;
  font-size: 13px;
  line-height: 1.6;
}

.terminal-line {
  color: rgba(255, 255, 255, 0.8);
  white-space: pre-wrap;
}

.terminal-line.terminal-command {
  color: #24c8db;
  font-weight: 500;
}

.terminal-line.terminal-done {
  color: #27c93f;
}

/* Welcome Content */
.welcome-container {
  flex: 1;
  overflow-y: auto;
  padding: 48px 32px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.welcome-content {
  max-width: 600px;
  text-align: center;
}

.welcome-logo {
  width: 80px;
  height: 80px;
  margin-bottom: 20px;
  filter: drop-shadow(0 0 24px rgba(36, 200, 219, 0.4));
}

.welcome-title {
  font-size: 32px;
  font-weight: 700;
  margin-bottom: 12px;
  background: linear-gradient(135deg, #24c8db, #41d1ff, #bd34fe);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.welcome-subtitle {
  font-size: 15px;
  color: rgba(255, 255, 255, 0.6);
  margin-bottom: 40px;
  line-height: 1.6;
}

/* Download Section */
.download-section {
  margin-top: 24px;
}

.download-title {
  font-size: 18px;
  font-weight: 600;
  margin-bottom: 20px;
  color: #fff;
}

.download-buttons {
  display: flex;
  gap: 16px;
  justify-content: center;
  flex-wrap: wrap;
  margin-bottom: 20px;
}

.download-btn {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 16px 24px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  color: #fff;
  text-decoration: none;
  transition: all 0.3s;
  min-width: 180px;
}

.download-btn:hover {
  background: rgba(36, 200, 219, 0.1);
  border-color: rgba(36, 200, 219, 0.5);
  transform: translateY(-3px);
  box-shadow: 0 8px 24px rgba(36, 200, 219, 0.2);
}

.download-info {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
}

.download-platform {
  font-size: 16px;
  font-weight: 600;
}

.download-arch {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.5);
}

.linux-icon {
  width: 32px;
  height: 32px;
}

.download-hint {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.4);
  margin: 0;
}

.security-warning {
  margin-top: 24px;
  padding: 16px;
  background: rgba(255, 200, 0, 0.08);
  border: 1px solid rgba(255, 200, 0, 0.2);
  border-radius: 8px;
  font-size: 12px;
  color: rgba(255, 220, 100, 0.9);
}

.security-warning p {
  margin: 0 0 8px 0;
  font-weight: 500;
}

.security-warning ul {
  margin: 0;
  padding-left: 20px;
  list-style: disc;
}

.security-warning li {
  margin: 4px 0;
  line-height: 1.5;
}

/* Status Bar */
.website-statusbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 22px;
  padding: 0 12px;
  background: #252529;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 0 0 12px 12px;
  font-size: 11px;
}

.statusbar-left, .statusbar-center, .statusbar-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.status-item {
  display: flex;
  align-items: center;
  gap: 4px;
  color: rgba(255, 255, 255, 0.4);
  text-decoration: none;
}

.status-item.demo-notice {
  color: rgba(255, 255, 255, 0.6);
  font-size: 12px;
}

.status-item.clickable {
  cursor: pointer;
  transition: color 0.2s;
}

.status-item.clickable:hover {
  color: #24c8db;
}

/* Dialog styles */
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

.port-dialog-content {
  min-height: 300px;
}

.port-filter {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
}

.port-filter .n-input {
  flex: 1;
}

.port-list {
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  overflow: hidden;
  max-height: 400px;
  overflow-y: auto;
}

.port-header {
  display: flex;
  padding: 10px 12px;
  background: rgba(255, 255, 255, 0.05);
  font-weight: 600;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.6);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.port-item {
  display: flex;
  padding: 10px 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  align-items: center;
}

.port-item:last-child {
  border-bottom: none;
}

.port-item:hover {
  background: rgba(255, 255, 255, 0.03);
}

.port-col {
  width: 150px;
  flex-shrink: 0;
}

.port-numbers {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.port-tag {
  font-family: 'Courier New', Courier, monospace;
  font-weight: 600;
}

.pid-col {
  width: 80px;
  flex-shrink: 0;
  font-family: 'Courier New', Courier, monospace;
  color: rgba(255, 255, 255, 0.6);
}

.name-col {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.action-col {
  width: 100px;
  flex-shrink: 0;
  text-align: right;
}

.no-ports {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 24px;
  color: rgba(255, 255, 255, 0.4);
}

/* Mode options in Add Folder dialog */
.mode-option {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.mode-title {
  font-weight: 500;
  font-size: 14px;
}

.mode-desc {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.5);
  line-height: 1.4;
}

/* Responsive */
@media (max-width: 1024px) {
  .website-desktop {
    padding: 20px;
  }
  
  .website-app {
    width: 100%;
    height: 100%;
    max-width: none;
    max-height: none;
    border-radius: 0;
  }
  
  .website-navbar {
    border-radius: 0;
  }
  
  .website-navbar::before {
    display: none;
  }
  
  .website-statusbar {
    border-radius: 0;
  }
}

@media (max-width: 768px) {
  .website-sidebar {
    display: none;
  }
  
  .download-buttons {
    flex-direction: column;
    align-items: center;
  }
}
</style>
