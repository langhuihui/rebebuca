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
  <div class="ai-tools-panel">
    <!-- AI Tools Layout - Left sidebar + Right content -->
    <div class="ai-tools-layout">
      <!-- Left sidebar with tool list -->
      <div class="tools-sidebar">
        <div
          v-for="toolType in availableTools"
          :key="toolType"
          class="tool-tab-item"
          :class="{ active: activeToolTab === toolType }"
          @click="selectTool(toolType)"
        >
          <img
            v-if="aiToolsStore.getToolLogoUrl(toolType)"
            :src="aiToolsStore.getToolLogoUrl(toolType)"
            :alt="AI_TOOL_METADATA[toolType].name"
            :class="['tool-logo', { 'tool-logo-invert-dark': ['opencode', 'augment-cli', 'ampcode', 'kilocode'].includes(toolType) }]"
            @error="handleLogoError"
          />
          {{ AI_TOOL_METADATA[toolType].name }}
        </div>
      </div>

      <!-- Right content area -->
      <div class="tools-content">
        <template v-for="toolType in availableTools" :key="toolType">
          <div v-if="activeToolTab === toolType" class="tool-panel">
            <!-- Tool Header -->
            <div class="tool-header-section">
              <div class="tool-status">
                <n-spin v-if="checkingInstall[toolType]" :size="14" />
                <template v-else-if="toolVersions[toolType]">
                  <n-tag type="success" size="small">
                    v{{ toolVersions[toolType] }}
                  </n-tag>
                  <n-tag
                    v-if="installSources[toolType]"
                    type="info"
                    size="small"
                    style="margin-left: 8px"
                  >
                    {{ getInstallSourceLabel(toolType) }}
                  </n-tag>
                  <n-tag
                    v-if="latestVersions[toolType] && isUpdateAvailable(toolType)"
                    type="warning"
                    size="small"
                    style="margin-left: 8px"
                  >
                    {{ t("aiTools.updateAvailable") }}: v{{ latestVersions[toolType] }}
                  </n-tag>
                  <n-tag
                    v-else-if="latestVersions[toolType] && !isUpdateAvailable(toolType)"
                    type="default"
                    size="small"
                    style="margin-left: 8px"
                  >
                    {{ t("aiTools.latestVersion") }}
                  </n-tag>
                </template>
                <n-tag v-else type="warning" size="small">
                  {{ t("aiTools.notInstalled") }}
                </n-tag>
                <n-button
                  text
                  size="tiny"
                  :loading="checkingInstall[toolType] || checkingVersion[toolType]"
                  :title="t('aiTools.refresh')"
                  @click="refreshToolStatus(toolType)"
                >
                  <template #icon>
                    <n-icon size="14">
                      <component :is="svgIcons.refresh" />
                    </n-icon>
                  </template>
                </n-button>
              </div>
            </div>

            <!-- Website Link -->
            <div class="tool-info">
              <span class="website-link" @click="openWebsite(toolType)">
                <n-icon
                  size="12"
                  style="margin-right: 4px; vertical-align: middle"
                >
                  <component :is="svgIcons.externalLink" />
                </n-icon>
                {{ AI_TOOL_METADATA[toolType].website }}
              </span>
            </div>

            <!-- Upgrade Section (when tool is installed, show regardless of update availability) -->
            <div v-if="toolVersions[toolType]" class="upgrade-section">
              <n-divider style="margin: 16px 0 12px 0">
                {{ t("aiTools.upgradeOptions") }}
              </n-divider>

              <!-- Package Manager Tabs for npm-based tools -->
              <n-tabs
                v-if="shouldShowNpmUpgradeTabs(toolType)"
                v-model:value="selectedUpgradePackageManager[toolType]"
                type="line"
                size="small"
                style="margin-bottom: 12px"
              >
                <n-tab-pane name="npm" tab="npm">
                  <div class="install-command">
                    <n-input-group>
                      <n-input
                        :value="getUpgradeCommand(toolType, 'npm')"
                        readonly
                        size="small"
                        style="font-family: monospace; font-size: 12px"
                      />
                      <n-button size="small" @click="copyCommand(getUpgradeCommand(toolType, 'npm'))">
                        <template #icon>
                          <n-icon size="14">
                            <component :is="svgIcons.copy" />
                          </n-icon>
                        </template>
                      </n-button>
                      <n-button
                        size="small"
                        type="primary"
                        @click="runUpgradeCommand(toolType, 'npm')"
                      >
                        {{ t("aiTools.upgrade") }}
                      </n-button>
                    </n-input-group>
                    <!-- Sudo/WSL options -->
                    <div class="command-options">
                      <template v-if="currentPlatform !== 'windows'">
                        <n-switch v-model:value="useSudoForUpgrade[toolType]" size="small" />
                        <span class="option-label">{{ t("aiTools.useSudo") }}</span>
                      </template>
                      <template v-else>
                        <n-switch v-model:value="useWslForUpgrade[toolType]" size="small" />
                        <span class="option-label">{{ t("aiTools.useWsl") }}</span>
                      </template>
                    </div>
                  </div>
                </n-tab-pane>
                <n-tab-pane name="pnpm" tab="pnpm">
                  <div class="install-command">
                    <n-input-group>
                      <n-input
                        :value="getUpgradeCommand(toolType, 'pnpm')"
                        readonly
                        size="small"
                        style="font-family: monospace; font-size: 12px"
                      />
                      <n-button size="small" @click="copyCommand(getUpgradeCommand(toolType, 'pnpm'))">
                        <template #icon>
                          <n-icon size="14">
                            <component :is="svgIcons.copy" />
                          </n-icon>
                        </template>
                      </n-button>
                      <n-button
                        size="small"
                        type="primary"
                        @click="runUpgradeCommand(toolType, 'pnpm')"
                      >
                        {{ t("aiTools.upgrade") }}
                      </n-button>
                    </n-input-group>
                    <!-- Sudo/WSL options -->
                    <div class="command-options">
                      <template v-if="currentPlatform !== 'windows'">
                        <n-switch v-model:value="useSudoForUpgrade[toolType]" size="small" />
                        <span class="option-label">{{ t("aiTools.useSudo") }}</span>
                      </template>
                      <template v-else>
                        <n-switch v-model:value="useWslForUpgrade[toolType]" size="small" />
                        <span class="option-label">{{ t("aiTools.useWsl") }}</span>
                      </template>
                    </div>
                  </div>
                </n-tab-pane>
                <n-tab-pane name="yarn" tab="yarn">
                  <div class="install-command">
                    <n-input-group>
                      <n-input
                        :value="getUpgradeCommand(toolType, 'yarn')"
                        readonly
                        size="small"
                        style="font-family: monospace; font-size: 12px"
                      />
                      <n-button size="small" @click="copyCommand(getUpgradeCommand(toolType, 'yarn'))">
                        <template #icon>
                          <n-icon size="14">
                            <component :is="svgIcons.copy" />
                          </n-icon>
                        </template>
                      </n-button>
                      <n-button
                        size="small"
                        type="primary"
                        @click="runUpgradeCommand(toolType, 'yarn')"
                      >
                        {{ t("aiTools.upgrade") }}
                      </n-button>
                    </n-input-group>
                    <!-- Sudo/WSL options -->
                    <div class="command-options">
                      <template v-if="currentPlatform !== 'windows'">
                        <n-switch v-model:value="useSudoForUpgrade[toolType]" size="small" />
                        <span class="option-label">{{ t("aiTools.useSudo") }}</span>
                      </template>
                      <template v-else>
                        <n-switch v-model:value="useWslForUpgrade[toolType]" size="small" />
                        <span class="option-label">{{ t("aiTools.useWsl") }}</span>
                      </template>
                    </div>
                  </div>
                </n-tab-pane>
              </n-tabs>

              <!-- Non-npm tools: show update command or install methods for upgrade -->
              <template v-else>
                <!-- Tools with dedicated update command (e.g., copilot-cli, codebuddy) -->
                <div v-if="getToolUpdateCommand(toolType)" class="install-command">
                  <div class="method-label">{{ t("aiTools.upgradeCommand") }}</div>
                  <n-input-group>
                    <n-input
                      :value="getToolUpdateCommand(toolType)"
                      readonly
                      size="small"
                      style="font-family: monospace; font-size: 12px"
                    />
                    <n-button size="small" @click="copyCommand(getToolUpdateCommand(toolType) || '')">
                      <template #icon>
                        <n-icon size="14">
                          <component :is="svgIcons.copy" />
                        </n-icon>
                      </template>
                    </n-button>
                    <n-button
                      size="small"
                      type="primary"
                      @click="updateTool(toolType, useSudoForUpgrade[toolType] || false, useWslForUpgrade[toolType] || false)"
                    >
                      {{ t("aiTools.upgrade") }}
                    </n-button>
                  </n-input-group>
                  <!-- Sudo/WSL options -->
                  <div class="command-options">
                    <template v-if="currentPlatform !== 'windows'">
                      <n-switch v-model:value="useSudoForUpgrade[toolType]" size="small" />
                      <span class="option-label">{{ t("aiTools.useSudo") }}</span>
                    </template>
                    <template v-else>
                      <n-switch v-model:value="useWslForUpgrade[toolType]" size="small" />
                      <span class="option-label">{{ t("aiTools.useWsl") }}</span>
                    </template>
                  </div>
                </div>
                <!-- Tools without update command: show install methods for reinstall/upgrade -->
                <div v-else>
                  <n-text depth="3" style="font-size: 12px; display: block; margin-bottom: 12px;">
                    {{ t("aiTools.reinstallToUpgrade") }}
                  </n-text>
                  <div
                    v-for="method in getAvailableInstallMethods(toolType)"
                    :key="method.id"
                    class="install-command"
                  >
                    <div class="method-label">{{ method.name }}</div>
                    <n-input-group>
                      <n-input
                        :value="method.command"
                        readonly
                        size="small"
                        style="font-family: monospace; font-size: 12px"
                      />
                      <n-button size="small" @click="copyCommand(method.command)">
                        <template #icon>
                          <n-icon size="14">
                            <component :is="svgIcons.copy" />
                          </n-icon>
                        </template>
                      </n-button>
                      <n-button
                        size="small"
                        type="primary"
                        :loading="upgradingTerminal === toolType"
                        @click="runInstallCommand(toolType, method, useSudoForUpgrade[toolType] || false, useWslForUpgrade[toolType] || false)"
                      >
                        {{ t("aiTools.reinstall") }}
                      </n-button>
                    </n-input-group>
                  </div>
                  <!-- Sudo/WSL options -->
                  <div class="command-options" style="margin-top: 8px;">
                    <template v-if="currentPlatform !== 'windows'">
                      <n-switch v-model:value="useSudoForUpgrade[toolType]" size="small" />
                      <span class="option-label">{{ t("aiTools.useSudo") }}</span>
                    </template>
                    <template v-else>
                      <n-switch v-model:value="useWslForUpgrade[toolType]" size="small" />
                      <span class="option-label">{{ t("aiTools.useWsl") }}</span>
                    </template>
                  </div>
                </div>
              </template>
            </div>

            <!-- Installation Section (when not installed) -->
            <div v-if="!toolVersions[toolType]" class="install-section">
              <n-divider style="margin: 16px 0 12px 0">
                {{ t("aiTools.installOptions") }}
              </n-divider>

              <!-- Package Manager Tabs for npm-based methods -->
              <template v-if="hasNpmInstallMethod(toolType)">
                <n-tabs
                  v-model:value="selectedPackageManager[toolType]"
                  type="line"
                  size="small"
                  style="margin-bottom: 12px"
                >
                  <n-tab-pane name="npm" tab="npm">
                    <div class="install-command">
                      <n-input-group>
                        <n-input
                          :value="getNpmInstallCommand(toolType, 'npm')"
                          readonly
                          size="small"
                          style="font-family: monospace; font-size: 12px"
                        />
                        <n-button size="small" @click="copyCommand(getNpmInstallCommand(toolType, 'npm'))">
                          <template #icon>
                            <n-icon size="14">
                              <component :is="svgIcons.copy" />
                            </n-icon>
                          </template>
                        </n-button>
                        <n-button
                          size="small"
                          type="primary"
                          @click="runNpmInstallCommand(toolType, 'npm')"
                        >
                          {{ t("aiTools.install") }}
                        </n-button>
                      </n-input-group>
                      <!-- Sudo/WSL options -->
                      <div class="command-options">
                        <template v-if="currentPlatform !== 'windows'">
                          <n-switch v-model:value="useSudoForInstall[toolType]" size="small" />
                          <span class="option-label">{{ t("aiTools.useSudo") }}</span>
                        </template>
                        <template v-else>
                          <n-switch v-model:value="useWslForInstall[toolType]" size="small" />
                          <span class="option-label">{{ t("aiTools.useWsl") }}</span>
                        </template>
                      </div>
                    </div>
                  </n-tab-pane>
                  <n-tab-pane name="pnpm" tab="pnpm">
                    <div class="install-command">
                      <n-input-group>
                        <n-input
                          :value="getNpmInstallCommand(toolType, 'pnpm')"
                          readonly
                          size="small"
                          style="font-family: monospace; font-size: 12px"
                        />
                        <n-button size="small" @click="copyCommand(getNpmInstallCommand(toolType, 'pnpm'))">
                          <template #icon>
                            <n-icon size="14">
                              <component :is="svgIcons.copy" />
                            </n-icon>
                          </template>
                        </n-button>
                        <n-button
                          size="small"
                          type="primary"
                          @click="runNpmInstallCommand(toolType, 'pnpm')"
                        >
                          {{ t("aiTools.install") }}
                        </n-button>
                      </n-input-group>
                      <!-- Sudo/WSL options -->
                      <div class="command-options">
                        <template v-if="currentPlatform !== 'windows'">
                          <n-switch v-model:value="useSudoForInstall[toolType]" size="small" />
                          <span class="option-label">{{ t("aiTools.useSudo") }}</span>
                        </template>
                        <template v-else>
                          <n-switch v-model:value="useWslForInstall[toolType]" size="small" />
                          <span class="option-label">{{ t("aiTools.useWsl") }}</span>
                        </template>
                      </div>
                    </div>
                  </n-tab-pane>
                  <n-tab-pane name="yarn" tab="yarn">
                    <div class="install-command">
                      <n-input-group>
                        <n-input
                          :value="getNpmInstallCommand(toolType, 'yarn')"
                          readonly
                          size="small"
                          style="font-family: monospace; font-size: 12px"
                        />
                        <n-button size="small" @click="copyCommand(getNpmInstallCommand(toolType, 'yarn'))">
                          <template #icon>
                            <n-icon size="14">
                              <component :is="svgIcons.copy" />
                            </n-icon>
                          </template>
                        </n-button>
                        <n-button
                          size="small"
                          type="primary"
                          @click="runNpmInstallCommand(toolType, 'yarn')"
                        >
                          {{ t("aiTools.install") }}
                        </n-button>
                      </n-input-group>
                      <!-- Sudo/WSL options -->
                      <div class="command-options">
                        <template v-if="currentPlatform !== 'windows'">
                          <n-switch v-model:value="useSudoForInstall[toolType]" size="small" />
                          <span class="option-label">{{ t("aiTools.useSudo") }}</span>
                        </template>
                        <template v-else>
                          <n-switch v-model:value="useWslForInstall[toolType]" size="small" />
                          <span class="option-label">{{ t("aiTools.useWsl") }}</span>
                        </template>
                      </div>
                    </div>
                  </n-tab-pane>
                </n-tabs>
              </template>

              <!-- Other Install Methods (non-npm) -->
              <template v-if="getNonNpmInstallMethods(toolType).length > 0">
                <n-divider v-if="hasNpmInstallMethod(toolType)" style="margin: 12px 0 8px 0" title-placement="left">
                  <span style="font-size: 12px; color: var(--n-text-color-3)">{{ t("aiTools.otherMethods") }}</span>
                </n-divider>
                <n-tabs
                  v-if="getNonNpmInstallMethods(toolType).length > 1"
                  v-model:value="selectedInstallMethod[toolType]"
                  type="line"
                  size="small"
                  style="margin-bottom: 12px"
                >
                  <n-tab-pane
                    v-for="method in getNonNpmInstallMethods(toolType)"
                    :key="method.id"
                    :name="method.id"
                    :tab="method.name"
                  >
                    <div class="install-command">
                      <n-input-group>
                        <n-input
                          :value="method.command"
                          readonly
                          size="small"
                          style="font-family: monospace; font-size: 12px"
                        />
                        <n-button
                          size="small"
                          @click="copyCommand(method.command)"
                        >
                          <template #icon>
                            <n-icon size="14">
                              <component :is="svgIcons.copy" />
                            </n-icon>
                          </template>
                        </n-button>
                        <n-button
                          size="small"
                          type="primary"
                          @click="runInstallCommandWithOptions(toolType, method)"
                        >
                          {{ t("aiTools.install") }}
                        </n-button>
                      </n-input-group>
                      <!-- Sudo/WSL options -->
                      <div class="command-options">
                        <template v-if="currentPlatform !== 'windows'">
                          <n-switch v-model:value="useSudoForInstall[toolType]" size="small" />
                          <span class="option-label">{{ t("aiTools.useSudo") }}</span>
                        </template>
                        <template v-else>
                          <n-switch v-model:value="useWslForInstall[toolType]" size="small" />
                          <span class="option-label">{{ t("aiTools.useWsl") }}</span>
                        </template>
                      </div>
                    </div>
                  </n-tab-pane>
                </n-tabs>

                <!-- Single Non-npm Install Method -->
                <div v-else class="install-command">
                  <div
                    v-for="method in getNonNpmInstallMethods(toolType)"
                    :key="method.id"
                  >
                    <div class="method-label">{{ method.name }}</div>
                    <n-input-group>
                      <n-input
                        :value="method.command"
                        readonly
                        size="small"
                        style="font-family: monospace; font-size: 12px"
                      />
                      <n-button size="small" @click="copyCommand(method.command)">
                        <template #icon>
                          <n-icon size="14">
                            <component :is="svgIcons.copy" />
                          </n-icon>
                        </template>
                      </n-button>
                      <n-button
                        size="small"
                        type="primary"
                        @click="runInstallCommandWithOptions(toolType, method)"
                      >
                        {{ t("aiTools.install") }}
                      </n-button>
                    </n-input-group>
                    <!-- Sudo/WSL options -->
                    <div class="command-options">
                      <template v-if="currentPlatform !== 'windows'">
                        <n-switch v-model:value="useSudoForInstall[toolType]" size="small" />
                        <span class="option-label">{{ t("aiTools.useSudo") }}</span>
                      </template>
                      <template v-else>
                        <n-switch v-model:value="useWslForInstall[toolType]" size="small" />
                        <span class="option-label">{{ t("aiTools.useWsl") }}</span>
                      </template>
                    </div>
                  </div>
                </div>
              </template>

              <!-- No install methods available for tools without npm -->
              <div v-if="!hasNpmInstallMethod(toolType) && getNonNpmInstallMethods(toolType).length === 0" class="install-command">
                <div
                  v-for="method in getAvailableInstallMethods(toolType)"
                  :key="method.id"
                >
                  <div class="method-label">{{ method.name }}</div>
                  <n-input-group>
                    <n-input
                      :value="method.command"
                      readonly
                      size="small"
                      style="font-family: monospace; font-size: 12px"
                    />
                    <n-button size="small" @click="copyCommand(method.command)">
                      <template #icon>
                        <n-icon size="14">
                          <component :is="svgIcons.copy" />
                        </n-icon>
                      </template>
                    </n-button>
                    <n-button
                      size="small"
                      type="primary"
                      @click="runInstallCommandWithOptions(toolType, method)"
                    >
                      {{ t("aiTools.install") }}
                    </n-button>
                  </n-input-group>
                  <!-- Sudo/WSL options -->
                  <div class="command-options">
                    <template v-if="currentPlatform !== 'windows'">
                      <n-switch v-model:value="useSudoForInstall[toolType]" size="small" />
                      <span class="option-label">{{ t("aiTools.useSudo") }}</span>
                    </template>
                    <template v-else>
                      <n-switch v-model:value="useWslForInstall[toolType]" size="small" />
                      <span class="option-label">{{ t("aiTools.useWsl") }}</span>
                    </template>
                  </div>
                </div>
              </div>
            </div>

            <!-- Uninstall Section (when installed) -->
            <div v-if="toolVersions[toolType] && getAvailableUninstallMethods(toolType).length > 0" class="uninstall-section">
              <n-divider style="margin: 16px 0 12px 0">
                {{ t("aiTools.uninstallOptions") }}
              </n-divider>

              <!-- Uninstall Methods Tabs -->
              <n-tabs
                v-if="getAvailableUninstallMethods(toolType).length > 1"
                v-model:value="selectedUninstallMethod[toolType]"
                type="line"
                size="small"
                style="margin-bottom: 12px"
              >
                <n-tab-pane
                  v-for="method in getAvailableUninstallMethods(toolType)"
                  :key="method.id"
                  :name="method.id"
                  :tab="method.name"
                >
                  <div class="install-command">
                    <n-input-group>
                      <n-input
                        :value="method.command"
                        readonly
                        size="small"
                        style="font-family: monospace; font-size: 12px"
                      />
                      <n-button
                        size="small"
                        @click="copyCommand(method.command)"
                      >
                        <template #icon>
                          <n-icon size="14">
                            <component :is="svgIcons.copy" />
                          </n-icon>
                        </template>
                      </n-button>
                      <n-button
                        size="small"
                        type="error"
                        @click="runUninstallCommandWithOptions(toolType, method)"
                      >
                        {{ t("aiTools.uninstall") }}
                      </n-button>
                    </n-input-group>
                    <!-- Sudo/WSL options -->
                    <div class="command-options">
                      <template v-if="currentPlatform !== 'windows'">
                        <n-switch v-model:value="useSudoForUninstall[toolType]" size="small" />
                        <span class="option-label">{{ t("aiTools.useSudo") }}</span>
                      </template>
                      <template v-else>
                        <n-switch v-model:value="useWslForUninstall[toolType]" size="small" />
                        <span class="option-label">{{ t("aiTools.useWsl") }}</span>
                      </template>
                    </div>
                  </div>
                </n-tab-pane>
              </n-tabs>

              <!-- Single Uninstall Method (no tabs needed) -->
              <div v-else class="install-command">
                <div
                  v-for="method in getAvailableUninstallMethods(toolType)"
                  :key="method.id"
                >
                  <div class="method-label">{{ method.name }}</div>
                  <n-input-group>
                    <n-input
                      :value="method.command"
                      readonly
                      size="small"
                      style="font-family: monospace; font-size: 12px"
                    />
                    <n-button size="small" @click="copyCommand(method.command)">
                      <template #icon>
                        <n-icon size="14">
                          <component :is="svgIcons.copy" />
                        </n-icon>
                      </template>
                    </n-button>
                    <n-button
                      size="small"
                      type="error"
                      @click="runUninstallCommandWithOptions(toolType, method)"
                    >
                      {{ t("aiTools.uninstall") }}
                    </n-button>
                  </n-input-group>
                  <!-- Sudo/WSL options -->
                  <div class="command-options">
                    <template v-if="currentPlatform !== 'windows'">
                      <n-switch v-model:value="useSudoForUninstall[toolType]" size="small" />
                      <span class="option-label">{{ t("aiTools.useSudo") }}</span>
                    </template>
                    <template v-else>
                      <n-switch v-model:value="useWslForUninstall[toolType]" size="small" />
                      <span class="option-label">{{ t("aiTools.useWsl") }}</span>
                    </template>
                  </div>
                </div>
              </div>
            </div>

            <!-- Installation Terminal (for PTY-based operation on all platforms) -->
            <div v-if="installingTerminal === toolType || upgradingTerminal === toolType" class="install-terminal-section">
              <n-divider style="margin: 16px 0 12px 0">
                {{ upgradingTerminal === toolType ? t("aiTools.upgradeOutput") : t("aiTools.installationOutput") }}
              </n-divider>
              <div class="install-terminal-wrapper" v-if="installingTerminal === toolType">
                <TerminalView
                  v-if="installPtyId"
                  :pty-id="installPtyId"
                  theme="dark"
                  :attach-only="true"
                />
              </div>
              <div class="install-terminal-wrapper" v-if="upgradingTerminal === toolType">
                <TerminalView
                  v-if="upgradePtyId"
                  :pty-id="upgradePtyId"
                  theme="dark"
                  :attach-only="true"
                />
              </div>
            </div>

            <!-- Configuration Section -->
            <n-divider style="margin: 16px 0 12px 0">
              {{ t("aiTools.configuration") }}
            </n-divider>

            <n-space vertical :size="12">
              <!-- Provider Selection -->
              <n-form-item
                :label="t('aiTools.provider')"
                :show-feedback="false"
                label-placement="left"
                label-width="100"
              >
                <n-select
                  v-model:value="toolConfigsLocal[toolType].provider"
                  :options="getProviderOptions(toolType)"
                  size="small"
                  style="width: 200px"
                  @update:value="saveToolConfig(toolType)"
                />
              </n-form-item>

              <!-- API Key Input (not for 'original' mode) -->
              <n-form-item
                v-if="toolConfigsLocal[toolType].provider !== 'original'"
                :label="t('aiTools.apiKey')"
                :show-feedback="false"
                label-placement="left"
                label-width="100"
              >
                <n-input-group>
                  <n-input
                    v-model:value="toolConfigsLocal[toolType].apiKey"
                    type="password"
                    :placeholder="t('aiTools.apiKeyPlaceholder')"
                    show-password-on="click"
                    size="small"
                    style="width: 200px"
                    @blur="saveToolConfig(toolType)"
                  />
                  <n-button
                    v-if="getKeyUrl(toolType)"
                    size="small"
                    @click="openGetKeyUrl(toolType)"
                  >
                    {{ t("aiTools.getKey") }}
                  </n-button>
                </n-input-group>
              </n-form-item>

              <!-- Custom Endpoint (for 'custom' provider) -->
              <n-form-item
                v-if="toolConfigsLocal[toolType].provider === 'custom'"
                :label="t('aiTools.customEndpoint')"
                :show-feedback="false"
                label-placement="left"
                label-width="100"
              >
                <n-input
                  v-model:value="toolConfigsLocal[toolType].customEndpoint"
                  :placeholder="t('aiTools.customEndpointPlaceholder')"
                  size="small"
                  style="width: 250px"
                  @blur="saveToolConfig(toolType)"
                />
              </n-form-item>

              <!-- Key Sync Notice -->
              <n-alert
                v-if="toolConfigsLocal[toolType].provider !== 'original'"
                type="default"
                :bordered="false"
                size="small"
              >
                {{ t("aiTools.keySyncNotice") }}
              </n-alert>
            </n-space>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, watch } from "vue";
import { useI18n } from "vue-i18n";
import {
  NSpace,
  NTabs,
  NTabPane,
  NTag,
  NButton,
  NIcon,
  NAlert,
  NInput,
  NInputGroup,
  NFormItem,
  NSelect,
  NDivider,
  NSpin,
  NSwitch,
  useMessage,
} from "naive-ui";
import {
  useAIToolsStore,
  AI_TOOL_METADATA,
  PROVIDER_PRESETS,
  type AIToolType,
  type AIToolConfig,
} from "../../stores/aiTools";
import TerminalView from "../TerminalView.vue";
import { svgIcons } from "../../utils/icons";
import { useSettingsStore } from "../../stores/settings";
import {
  getLatestVersion,
  isVersionNewer,
  getUpdateCommand,
} from "../../utils/aiToolVersionChecker";

const { t } = useI18n();
const message = useMessage();
const aiToolsStore = useAIToolsStore();
const settingsStore = useSettingsStore();

// Available AI tools
const availableTools: AIToolType[] = [
  "claude-code",
  "codex",
  "gemini-cli",
  "opencode",
  "codebuddy",
  "qoder-cli",
  "copilot-cli",
  "droid",
  "augment-cli",
  "cursor-cli",
  "crush",
  "ampcode",
  "kilocode",
];

// Active tool tab
const activeToolTab = ref<AIToolType>("claude-code");

// Selected install method for each tool
const selectedInstallMethod = ref<Record<string, string>>({});

// Selected uninstall method for each tool
const selectedUninstallMethod = ref<Record<string, string>>({});

// Selected package manager for npm-based tools (npm, pnpm, yarn)
const selectedPackageManager = ref<Record<string, 'npm' | 'pnpm' | 'yarn'>>({});

// Selected package manager for upgrade
const selectedUpgradePackageManager = ref<Record<string, 'npm' | 'pnpm' | 'yarn'>>({});

// Use sudo switch state for each tool
const useSudoForInstall = ref<Record<string, boolean>>({});
const useSudoForUninstall = ref<Record<string, boolean>>({});
const useSudoForUpgrade = ref<Record<string, boolean>>({});

// Use WSL switch state for Windows
const useWslForInstall = ref<Record<string, boolean>>({});
const useWslForUninstall = ref<Record<string, boolean>>({});
const useWslForUpgrade = ref<Record<string, boolean>>({});

// Tool versions (empty string means not installed)
const toolVersions = ref<Record<string, string>>({});

// Latest versions from registry
const latestVersions = ref<Record<string, string>>({});

// Install check state
const checkingInstall = ref<Record<string, boolean>>({});

// Version check state
const checkingVersion = ref<Record<string, boolean>>({});

// Update state
const updating = ref<Record<string, boolean>>({});

// Track which tools have been checked to avoid repeated checks
const checkedTools = ref<Record<string, boolean>>({});
type InstallSource = "npm" | "brew" | "winget" | "script" | "unknown";
const installSources = ref<Record<string, InstallSource>>({});

// Installation terminal state (for Windows PTY-based installation)
const installingTerminal = ref<AIToolType | null>(null);
const upgradingTerminal = ref<AIToolType | null>(null);
const installPtyId = ref<string | null>(null);
const upgradePtyId = ref<string | null>(null);

// Show upgrade panel state
const showingUpgradePanel = ref<Record<string, boolean>>({});

// Local tool configs for inline editing - initialize with defaults
const toolConfigsLocal = reactive<Record<AIToolType, Partial<AIToolConfig>>>({
  "claude-code": { provider: "original", apiKey: "", customEndpoint: "" },
  codex: { provider: "original", apiKey: "", customEndpoint: "" },
  "gemini-cli": { provider: "original", apiKey: "", customEndpoint: "" },
  opencode: { provider: "original", apiKey: "", customEndpoint: "" },
  codebuddy: { provider: "original", apiKey: "", customEndpoint: "" },
  "qoder-cli": { provider: "original", apiKey: "", customEndpoint: "" },
  "copilot-cli": { provider: "original", apiKey: "", customEndpoint: "" },
  droid: { provider: "original", apiKey: "", customEndpoint: "" },
  "augment-cli": { provider: "original", apiKey: "", customEndpoint: "" },
  "cursor-cli": { provider: "original", apiKey: "", customEndpoint: "" },
  crush: { provider: "original", apiKey: "", customEndpoint: "" },
  ampcode: { provider: "original", apiKey: "", customEndpoint: "" },
  kilocode: { provider: "original", apiKey: "", customEndpoint: "" },
});

// Current platform
const currentPlatform = ref<"macos" | "linux" | "windows">("macos");

onMounted(async () => {
  await aiToolsStore.loadConfigurations();
  initLocalConfigs();
  await detectPlatform();
  initSelectedInstallMethods();
  
  // Check the initially selected tool on mount
  // Add delay to avoid terminal flash during startup on Windows
  // The detection will run silently in the background
  if (!checkedTools.value[activeToolTab.value] && !checkingInstall.value[activeToolTab.value]) {
    // Small delay to let the UI render first
    setTimeout(async () => {
      await checkSingleTool(activeToolTab.value);
      // Check version if tool is installed
      if (toolVersions.value[activeToolTab.value]) {
        checkLatestVersion(activeToolTab.value);
      }
    }, 100);
  }
});

// Watch for store changes and sync to local
watch(
  () => aiToolsStore.toolConfigs,
  () => {
    initLocalConfigs();
  },
  { deep: true }
);

// Handle tool tab click
const selectTool = (toolType: AIToolType) => {
  activeToolTab.value = toolType;
};

// Watch for tab changes and auto-check installation status and version
watch(activeToolTab, async (newTool) => {
  // Auto-check installation status if not already checked or checking
  // This prevents repeated checks and permission dialogs on macOS
  if (!checkedTools.value[newTool] && !checkingInstall.value[newTool]) {
    await checkSingleTool(newTool);
    // After checking installation, if tool is installed, check version
    if (toolVersions.value[newTool]) {
      checkLatestVersion(newTool);
    }
  } else {
    // Tool already checked, just check version if installed (always check on tab activation for latest version)
    if (toolVersions.value[newTool]) {
      checkLatestVersion(newTool);
    }
  }
});

// Initialize local configs from store
const initLocalConfigs = () => {
  for (const toolType of availableTools) {
    const config = aiToolsStore.toolConfigs[toolType];
    // Handle case where config might be undefined (e.g., older stored data)
    if (config) {
      toolConfigsLocal[toolType] = {
        provider: config.provider || "original",
        apiKey: config.apiKey || "",
        customEndpoint: config.customEndpoint || "",
      };
    } else {
      // Use default values if config is undefined
      toolConfigsLocal[toolType] = {
        provider: "original",
        apiKey: "",
        customEndpoint: "",
      };
    }
  }
};

// Initialize selected install methods
const initSelectedInstallMethods = () => {
  for (const toolType of availableTools) {
    const methods = getAvailableInstallMethods(toolType);
    if (methods.length > 0) {
      selectedInstallMethod.value[toolType] = methods[0].id;
    }
    const uninstallMethods = getAvailableUninstallMethods(toolType);
    if (uninstallMethods.length > 0) {
      selectedUninstallMethod.value[toolType] = uninstallMethods[0].id;
    }
    // Initialize package manager selection (default to npm)
    selectedPackageManager.value[toolType] = 'npm';
    selectedUpgradePackageManager.value[toolType] = 'npm';
    // Initialize sudo/WSL switches (default to false)
    useSudoForInstall.value[toolType] = false;
    useSudoForUninstall.value[toolType] = false;
    useSudoForUpgrade.value[toolType] = false;
    useWslForInstall.value[toolType] = false;
    useWslForUninstall.value[toolType] = false;
    useWslForUpgrade.value[toolType] = false;
    // Initialize upgrade panel visibility
    showingUpgradePanel.value[toolType] = false;
  }
};

const detectPlatform = async () => {
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes("win")) {
    currentPlatform.value = "windows";
  } else if (ua.includes("mac")) {
    currentPlatform.value = "macos";
  } else {
    currentPlatform.value = "linux";
  }
};

// Get install methods available for current platform
const getAvailableInstallMethods = (toolType: AIToolType) => {
  const methods = AI_TOOL_METADATA[toolType].installMethods;
  return methods.filter(
    (m) => m.platform === "all" || m.platform === currentPlatform.value
  );
};

// Get uninstall methods available for current platform
const getAvailableUninstallMethods = (toolType: AIToolType) => {
  if (toolType === "claude-code" && toolVersions.value[toolType]) {
    const source = installSources.value[toolType];
    if (source === "npm") {
      return [{ id: "npm", name: "NPM", command: "npm uninstall -g @anthropic-ai/claude-code", platform: "all" as const }];
    }
    if (source === "brew") {
      return [{ id: "brew", name: "Homebrew", command: "brew uninstall --cask claude-code", platform: "macos" as const }];
    }
    if (source === "winget") {
      return [{ id: "winget", name: "WinGet", command: "winget uninstall Anthropic.ClaudeCode", platform: "windows" as const }];
    }
  }

  const methods = AI_TOOL_METADATA[toolType].uninstallMethods || [];
  return methods.filter(
    (m) => m.platform === "all" || m.platform === currentPlatform.value
  );
};

// NPM package name mapping for AI tools
const NPM_PACKAGE_MAP: Record<AIToolType, string | null> = {
  'claude-code': '@anthropic-ai/claude-code',
  'codex': '@openai/codex',
  'gemini-cli': '@google/gemini-cli',
  'opencode': 'opencode-ai',
  'codebuddy': '@tencent-ai/codebuddy-code',
  'qoder-cli': '@qoder-ai/qodercli',
  'copilot-cli': '@github/copilot',
  'droid': null,
  'augment-cli': '@augmentcode/auggie',
  'cursor-cli': null,
  'crush': '@charmland/crush',
  'ampcode': null,
  'kilocode': '@kilocode/cli',
};

const CLAUDE_INSTALL_COMMANDS = {
  scriptUnix: "curl -fsSL https://claude.ai/install.sh | bash",
  brew: "brew install --cask claude-code",
  scriptWindows: "irm https://claude.ai/install.ps1 | iex",
  winget: "winget install Anthropic.ClaudeCode",
};

// Check if tool has npm package
const hasNpmPackage = (toolType: AIToolType): boolean => {
  return NPM_PACKAGE_MAP[toolType] !== null;
};

const shouldShowNpmUpgradeTabs = (toolType: AIToolType): boolean => {
  if (!hasNpmPackage(toolType)) return false;
  const source = installSources.value[toolType];
  return source === "npm" || source === "unknown" || !source;
};

const getInstallSourceLabel = (toolType: AIToolType): string => {
  const source = installSources.value[toolType];
  if (source === "npm") return "npm";
  if (source === "brew") return "Homebrew";
  if (source === "winget") return "WinGet";
  if (source === "script") return "Script";
  return "Unknown";
};

// Check if tool has npm install method
const hasNpmInstallMethod = (toolType: AIToolType): boolean => {
  const methods = getAvailableInstallMethods(toolType);
  return methods.some(m => m.id === 'npm' || m.command.includes('npm install'));
};

// Get non-npm install methods
const getNonNpmInstallMethods = (toolType: AIToolType) => {
  const methods = getAvailableInstallMethods(toolType);
  return methods.filter(m => m.id !== 'npm' && !m.command.includes('npm install') && !m.command.includes('pnpm install') && !m.command.includes('yarn global add'));
};

// Get npm install command with specified package manager
const getNpmInstallCommand = (toolType: AIToolType, pm: 'npm' | 'pnpm' | 'yarn'): string => {
  const packageName = NPM_PACKAGE_MAP[toolType];
  if (!packageName) return '';
  
  switch (pm) {
    case 'npm':
      return `npm install -g ${packageName}`;
    case 'pnpm':
      return `pnpm install -g ${packageName}`;
    case 'yarn':
      return `yarn global add ${packageName}`;
    default:
      return `npm install -g ${packageName}`;
  }
};

// Get upgrade command with specified package manager
const getUpgradeCommand = (toolType: AIToolType, pm: 'npm' | 'pnpm' | 'yarn'): string => {
  const packageName = NPM_PACKAGE_MAP[toolType];
  if (!packageName) return '';
  
  switch (pm) {
    case 'npm':
      return `npm install -g ${packageName}@latest`;
    case 'pnpm':
      return `pnpm install -g ${packageName}@latest`;
    case 'yarn':
      return `yarn global add ${packageName}@latest`;
    default:
      return `npm install -g ${packageName}@latest`;
  }
};

// Get tool update command (for non-npm tools)
const getToolUpdateCommand = (toolType: AIToolType): string | null => {
  if (toolType === "claude-code") {
    const source = installSources.value[toolType];
    if (source === "brew") return CLAUDE_INSTALL_COMMANDS.brew;
    if (source === "winget") return CLAUDE_INSTALL_COMMANDS.winget;
    if (source === "script") {
      return currentPlatform.value === "windows"
        ? CLAUDE_INSTALL_COMMANDS.scriptWindows
        : CLAUDE_INSTALL_COMMANDS.scriptUnix;
    }
    return null;
  }
  return getUpdateCommand(toolType);
};

// Run npm install command with selected package manager
const runNpmInstallCommand = async (toolType: AIToolType, pm: 'npm' | 'pnpm' | 'yarn') => {
  const command = getNpmInstallCommand(toolType, pm);
  const useSudo = useSudoForInstall.value[toolType] || false;
  const useWsl = useWslForInstall.value[toolType] || false;
  
  await runInstallCommand(toolType, { id: pm, command }, useSudo, useWsl);
};

// Run upgrade command with selected package manager
const runUpgradeCommand = async (toolType: AIToolType, pm: 'npm' | 'pnpm' | 'yarn') => {
  const command = getUpgradeCommand(toolType, pm);
  const useSudo = useSudoForUpgrade.value[toolType] || false;
  const useWsl = useWslForUpgrade.value[toolType] || false;
  
  await updateToolWithCommand(toolType, command, useSudo, useWsl);
};

// Run install command with options from switches
const runInstallCommandWithOptions = async (
  toolType: AIToolType,
  method: { command: string; id: string }
) => {
  const useSudo = useSudoForInstall.value[toolType] || false;
  const useWsl = useWslForInstall.value[toolType] || false;
  await runInstallCommand(toolType, method, useSudo, useWsl);
};

// Run uninstall command with options from switches
const runUninstallCommandWithOptions = async (
  toolType: AIToolType,
  method: { command: string; id: string }
) => {
  const useSudo = useSudoForUninstall.value[toolType] || false;
  const useWsl = useWslForUninstall.value[toolType] || false;
  await runUninstallCommand(toolType, method, useSudo, useWsl);
};

const runDetectionCommand = async (command: string, timeoutMs = 8000): Promise<string> => {
  try {
    const { getAdapter } = await import("../../adapters");
    const adapter = await getAdapter();

    return await new Promise<string>(async (resolve) => {
      let collectedOutput = "";
      let settled = false;
      let ptyId = "";
      let stopListeningData: (() => void) | undefined;
      let stopListeningExit: (() => void) | undefined;
      let timer: number | undefined;

      const cleanup = () => {
        if (timer !== undefined) {
          window.clearTimeout(timer);
        }
        stopListeningData?.();
        stopListeningExit?.();
      };

      try {
        const isWindows = currentPlatform.value === "windows";
        const terminal = await adapter.terminal.create({
          command: isWindows ? "powershell" : "sh",
          args: isWindows ? ["-Command", `${command} 2>&1`] : ["-lc", `${command} 2>&1`],
          cwd: undefined,
          env: undefined,
          logPath: undefined,
          shellPath: isWindows ? "powershell" : undefined,
        });

        ptyId = terminal.ptyId;

        stopListeningData = adapter.terminal.onData((event) => {
          if (event.ptyId !== ptyId || settled) return;
          collectedOutput += event.data;
        });

        stopListeningExit = adapter.terminal.onExit((event) => {
          if (event.ptyId !== ptyId || settled) return;
          settled = true;
          cleanup();
          resolve(collectedOutput);
        });

        timer = window.setTimeout(async () => {
          if (settled) return;
          settled = true;
          try {
            if (ptyId) {
              await adapter.terminal.kill(ptyId);
            }
          } catch {
            // ignore timeout kill failures
          }
          cleanup();
          resolve(collectedOutput);
        }, timeoutMs);
      } catch {
        cleanup();
        resolve("");
      }
    });
  } catch {
    return "";
  }
};

const detectNpmInstalledVersion = async (toolType: AIToolType): Promise<string | null> => {
  const npmPackageName = NPM_PACKAGE_MAP[toolType];
  if (!npmPackageName) return null;

  const npmOutput = await runDetectionCommand(`npm list -g ${npmPackageName} --depth=0`, 8000);
  const escapedPackageName = npmPackageName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const npmVersionRegex = new RegExp(`${escapedPackageName}@([0-9]+\\.[0-9]+\\.[0-9]+(?:[-+][A-Za-z0-9.-]+)?)`);
  const npmMatch = npmOutput.match(npmVersionRegex);
  return npmMatch?.[1] || null;
};

const detectBinaryPath = async (binary: string): Promise<string | null> => {
  const cmd = currentPlatform.value === "windows" ? `where ${binary}` : `command -v ${binary}`;
  const output = await runDetectionCommand(cmd, 5000);
  const lines = output
    .replace(/\u001b\[[0-9;]*m/g, "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  if (lines.length === 0) return null;
  return lines[0];
};

const inferInstallSourceByPath = (binaryPath: string | null, fallback: InstallSource = "unknown"): InstallSource => {
  if (!binaryPath) return fallback;
  const normalized = binaryPath.toLowerCase();
  if (normalized.includes("homebrew") || normalized.includes("/opt/homebrew/") || normalized.includes("/cellar/")) {
    return "brew";
  }
  if (normalized.includes("winget")) {
    return "winget";
  }
  if (normalized.includes("node_modules")) {
    return "npm";
  }
  return fallback;
};

const parseVersionFromOutput = (output: string): string | null => {
  const plainOutput = output.replace(/\u001b\[[0-9;]*m/g, "").trim();
  if (!plainOutput) return null;

  if (/command not found|not recognized|No such file|npm ERR!/i.test(plainOutput)) {
    return null;
  }

  const versionMatch = plainOutput.match(/v?\d+\.\d+\.\d+(?:[-+][A-Za-z0-9.-]+)?/);
  if (versionMatch) {
    return versionMatch[0].replace(/^v/i, "");
  }

  const noisePattern = /(setting up emsdk environment|emsdk_quiet=1)/i;
  const meaningfulLines = plainOutput
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !noisePattern.test(line));

  if (meaningfulLines.length === 0) return null;
  return meaningfulLines[meaningfulLines.length - 1];
};

const parseClaudeCliVersionFromOutput = (output: string): string | null => {
  const plainOutput = output.replace(/\u001b\[[0-9;]*m/g, "").trim();
  if (!plainOutput) return null;
  if (/command not found|not recognized|No such file/i.test(plainOutput)) {
    return null;
  }

  const lines = plainOutput
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  // 1) Prefer lines explicitly mentioning Claude Code.
  for (const line of lines) {
    if (!/claude code/i.test(line)) continue;
    const match = line.match(/v?(\d+\.\d+\.\d+(?:[-+][A-Za-z0-9.-]+)?)/i);
    if (match?.[1]) return match[1];
  }

  // 2) Prefer semver lines, excluding year-style build versions like 2025.x.x.
  for (const line of lines) {
    const match = line.match(/v?(\d+\.\d+\.\d+(?:[-+][A-Za-z0-9.-]+)?)/i);
    if (!match?.[1]) continue;
    if (/^\d{4}\./.test(match[1])) continue;
    return match[1];
  }

  // 3) Last resort: generic parser.
  return parseVersionFromOutput(output);
};

const detectInstalledToolInfo = async (toolType: AIToolType): Promise<{ version: string | null; source: InstallSource }> => {
  try {
    const binaryName = AI_TOOL_METADATA[toolType].launchCommand;
    const binaryPath = await detectBinaryPath(binaryName);

    // Claude Code has multiple common install sources and requires source-aware upgrade options.
    if (toolType === "claude-code") {
      if (currentPlatform.value !== "windows") {
        const brewOutput = await runDetectionCommand("brew list --cask claude-code", 8000);
        const hasBrewInstall = /claude-code/i.test(brewOutput) && !/not installed|Error:/i.test(brewOutput);
        if (hasBrewInstall) {
          const versionFromCli = parseClaudeCliVersionFromOutput(await runDetectionCommand("claude -v", 8000))
            || parseClaudeCliVersionFromOutput(await runDetectionCommand("claude --version", 8000));
          return { version: versionFromCli, source: "brew" };
        }
      } else {
        const wingetOutput = await runDetectionCommand("winget list --id Anthropic.ClaudeCode --exact", 8000);
        const hasWingetInstall = /Anthropic\.ClaudeCode/i.test(wingetOutput);
        if (hasWingetInstall) {
          const versionFromCli = parseClaudeCliVersionFromOutput(await runDetectionCommand("claude -v", 8000))
            || parseClaudeCliVersionFromOutput(await runDetectionCommand("claude --version", 8000));
          return { version: versionFromCli, source: "winget" };
        }
      }

      // Script/other installer fallback if CLI is available but package managers don't detect it.
      const claudeOutput = await runDetectionCommand("claude -v", 8000);
      const claudeVersion = parseClaudeCliVersionFromOutput(claudeOutput);
      if (claudeVersion) {
        return { version: claudeVersion, source: inferInstallSourceByPath(binaryPath, "script") };
      }
      const claudeLongOutput = await runDetectionCommand("claude --version", 8000);
      const longVersion = parseClaudeCliVersionFromOutput(claudeLongOutput);
      if (longVersion) {
        return { version: longVersion, source: inferInstallSourceByPath(binaryPath, "unknown") };
      }

      // NPM check last.
      const npmVersion = await detectNpmInstalledVersion(toolType);
      if (npmVersion) {
        return { version: npmVersion, source: inferInstallSourceByPath(binaryPath, "npm") };
      }
      return { version: null, source: "unknown" };
    }

    // 1) Prefer each tool's native version command / binary path first.
    const versionCommand = AI_TOOL_METADATA[toolType].versionCommand;
    if (!versionCommand) return { version: null, source: "unknown" };
    const fallbackOutput = await runDetectionCommand(versionCommand, 8000);
    const detectedVersion = parseVersionFromOutput(fallbackOutput);
    if (detectedVersion) {
      return { version: detectedVersion, source: inferInstallSourceByPath(binaryPath, "unknown") };
    }

    // 2) NPM check last.
    const npmVersion = await detectNpmInstalledVersion(toolType);
    if (npmVersion) {
      return { version: npmVersion, source: inferInstallSourceByPath(binaryPath, "npm") };
    }
    return { version: null, source: "unknown" };
  } catch (error) {
    console.error(`Failed to detect installation for ${toolType}:`, error);
    return { version: null, source: "unknown" };
  }
};

// Check if a single tool is installed
const checkSingleTool = async (toolType: AIToolType, _force = false) => {
  if (checkingInstall.value[toolType]) return;
  checkingInstall.value[toolType] = true;
  try {
    const { version: installedVersion, source } = await detectInstalledToolInfo(toolType);
    toolVersions.value[toolType] = installedVersion || "";
    installSources.value[toolType] = source;

    if (!installedVersion) {
      delete latestVersions.value[toolType];
      delete installSources.value[toolType];
    }
  } finally {
    checkedTools.value[toolType] = true;
    checkingInstall.value[toolType] = false;
  }
};

const openWebsite = async (toolType: AIToolType) => {
  const url = AI_TOOL_METADATA[toolType].website;
  window.open(url, "_blank");
};

// Copy command to clipboard
const copyCommand = async (command: string) => {
  try {
    await navigator.clipboard.writeText(command);
    message.success(t("common.copied"));
  } catch {
    message.error(t("common.copyFailed"));
  }
};

// Recheck install status and latest version immediately
const refreshToolStatus = async (toolType: AIToolType) => {
  await checkSingleTool(toolType, true);
  if (toolVersions.value[toolType]) {
    await checkLatestVersion(toolType);
  }
};

/**
 * Inject sudo password into command if stored
 */
const injectSudoPasswordIntoCommand = (command: string, useSudo: boolean): string => {
  if (!useSudo || currentPlatform.value === 'windows') {
    return command;
  }
  
  const sudoPassword = settingsStore.getSudoPassword();
  if (!sudoPassword) {
    // No password stored, use regular sudo (will prompt)
    return `sudo ${command}`;
  }
  
  // Escape password for shell (single quotes are safest)
  const escapedPassword = sudoPassword.replace(/'/g, "'\\''");
  
  // Build: echo 'password' | sudo -S <command>
  return `echo '${escapedPassword}' | sudo -S ${command}`;
};

// Run command in PTY (used for both install and uninstall on all platforms)
const runCommandInPty = async (
  toolType: AIToolType,
  command: string,
  onComplete: (exitCode: number) => void,
  isUpgrade: boolean = false
) => {
  try {
    // Set terminal state
    if (isUpgrade) {
      upgradingTerminal.value = toolType;
    } else {
      installingTerminal.value = toolType;
    }

    const { getAdapter } = await import("../../adapters");
    const adapter = await getAdapter();

    // Determine shell based on platform
    let shellPath: string | undefined;
    let execCommand: string;
    let execArgs: string[];

    if (currentPlatform.value === 'windows') {
      // Windows: use PowerShell
      shellPath = 'powershell';
      const parts = command.trim().split(/\s+/);
      execCommand = parts[0];
      execArgs = parts.slice(1);
    } else {
      // macOS/Linux: use zsh or bash with login shell
      // Execute the command directly via sh -c
      execCommand = 'sh';
      execArgs = ['-c', command];
    }

    // Execute the command in PTY
    const result = await adapter.terminal.create({
      command: execCommand,
      args: execArgs,
      cwd: undefined,
      env: undefined,
      logPath: undefined,
      shellPath: shellPath,
    });

    if (isUpgrade) {
      upgradePtyId.value = result.ptyId;
    } else {
      installPtyId.value = result.ptyId;
    }

    // Listen for PTY exit
    const unlistenExit = adapter.terminal.onExit((event) => {
      if (event.ptyId === result.ptyId) {
        unlistenExit();
        // Don't hide terminal immediately, let user see the result
        // installingTerminal.value = null;
        // upgradingTerminal.value = null;

        // Call completion callback
        setTimeout(() => {
          onComplete(event.exitCode ?? 0);
        }, 1000);
      }
    });

    return true;
  } catch (error) {
    console.error("PTY execution failed:", error);
    if (isUpgrade) {
      upgradingTerminal.value = null;
      upgradePtyId.value = null;
    } else {
      installingTerminal.value = null;
      installPtyId.value = null;
    }
    return false;
  }
};

const runUpgradeInPty = async (
  toolType: AIToolType,
  command: string,
  useSudo: boolean = false,
  useWsl: boolean = false
) => {
  if (upgradingTerminal.value === toolType) {
    return;
  }

  let finalCmd = useSudo ? injectSudoPasswordIntoCommand(command, useSudo) : command;
  if (useWsl && currentPlatform.value === 'windows') {
    finalCmd = `wsl ${finalCmd}`;
  }

  const started = await runCommandInPty(
    toolType,
    finalCmd,
    async (exitCode: number) => {
      if (exitCode === 0) {
        message.success(t("aiTools.updateSuccess"));
      } else {
        message.error(t("aiTools.updateFailed"));
      }

      await refreshToolStatus(toolType);
    },
    true
  );

  if (!started) {
    message.error(t("aiTools.installationFailed"));
  }
};

// Run install command
const runInstallCommand = async (
  toolType: AIToolType,
  method: { command: string; id: string },
  useSudo: boolean = false,
  useWsl: boolean = false
) => {
  const command = useSudo ? injectSudoPasswordIntoCommand(method.command, useSudo) : method.command;
  if (useWsl && currentPlatform.value === 'windows') {
    await copyCommand(`wsl ${command}`);
  } else {
    await copyCommand(command);
  }
  message.info(t("aiTools.copyAndRunManually"));
};

const runUninstallCommand = async (
  _toolType: AIToolType,
  method: { command: string; id: string },
  useSudo: boolean = false,
  useWsl: boolean = false
) => {
  const command = useSudo ? injectSudoPasswordIntoCommand(method.command, useSudo) : method.command;
  if (useWsl && currentPlatform.value === 'windows') {
    await copyCommand(`wsl ${command}`);
  } else {
    await copyCommand(command);
  }
  message.info(t("aiTools.copyAndRunManually"));
};

// Get provider options for a tool
const getProviderOptions = (toolType: AIToolType) => {
  return aiToolsStore.getProvidersForTool(toolType).map((preset) => ({
    label: preset.name,
    value: preset.id,
  }));
};

// Save tool configuration (inline)
const saveToolConfig = async (toolType: AIToolType) => {
  const localConfig = toolConfigsLocal[toolType];

  await aiToolsStore.updateToolConfig(toolType, {
    provider: localConfig.provider,
    apiKey: localConfig.apiKey,
    customEndpoint: localConfig.customEndpoint,
    enabled: true, // Auto-enable when configured
  });

  // Sync API key to provider
  if (localConfig.provider !== "original" && localConfig.apiKey) {
    await aiToolsStore.setProviderKey(
      localConfig.provider!,
      localConfig.apiKey
    );
  }
};

// Get "Get Key" URL for current provider
const getKeyUrl = (toolType: AIToolType): string | undefined => {
  const config = toolConfigsLocal[toolType];
  if (!config) return undefined;
  const preset = PROVIDER_PRESETS[config.provider!];
  return preset?.getKeyUrl;
};

const openGetKeyUrl = async (toolType: AIToolType) => {
  const url = getKeyUrl(toolType);
  if (url) window.open(url, "_blank");
};

// Check if update is available
const isUpdateAvailable = (toolType: AIToolType): boolean => {
  // copilot-cli always shows update button since we cannot detect version
  if (toolType === 'copilot-cli') {
    return true;
  }
  
  const current = toolVersions.value[toolType];
  const latest = latestVersions.value[toolType];
  
  if (!current || !latest) {
    return false;
  }
  
  return isVersionNewer(current, latest);
};

// Check latest version for a tool
const checkLatestVersion = async (toolType: AIToolType) => {
  if (!toolVersions.value[toolType]) {
    // Tool not installed, no need to check
    return;
  }
  
  if (checkingVersion.value[toolType]) {
    return;
  }
  
  checkingVersion.value[toolType] = true;
  
  try {
    const latest = await getLatestVersion(toolType);
    if (latest) {
      latestVersions.value[toolType] = latest;
    } else {
      message.warning(t("aiTools.versionCheckFailed"));
    }
  } catch (error) {
    console.error(`Failed to check latest version for ${toolType}:`, error);
    message.error(t("aiTools.versionCheckFailed"));
  } finally {
    checkingVersion.value[toolType] = false;
  }
};

// Handle logo load error
const handleLogoError = (event: Event) => {
  const img = event.target as HTMLImageElement;
  if (img) {
    img.style.display = 'none';
  }
};

const updateTool = async (toolType: AIToolType, useSudo: boolean = false, useWsl: boolean = false) => {
  const updateCmd = getUpdateCommand(toolType);
  if (!updateCmd) {
    message.warning(t("aiTools.updateNotSupported"));
    return;
  }
  await runUpgradeInPty(toolType, updateCmd, useSudo, useWsl);
};

const updateToolWithCommand = async (toolType: AIToolType, command: string, useSudo: boolean = false, useWsl: boolean = false) => {
  await runUpgradeInPty(toolType, command, useSudo, useWsl);
};

</script>

<style scoped>
.ai-tools-panel {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.ai-tools-layout {
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

.tools-sidebar {
  width: 180px;
  min-width: 180px;
  background-color: var(--n-color-modal);
  border-right: 1px solid var(--n-border-color);
  padding: 12px 0;
  overflow-y: auto;
  flex-shrink: 0;
}

.tool-tab-item {
  padding: 8px 16px;
  cursor: pointer;
  font-size: 13px;
  color: var(--n-text-color);
  transition: all 0.2s;
  border-left: 2px solid transparent;
  display: flex;
  align-items: center;
  gap: 8px;
}

.tool-logo {
  width: 16px;
  height: 16px;
  object-fit: contain;
  flex-shrink: 0;
}

.tool-tab-item:hover {
  background-color: var(--n-color-hover);
}

.tool-tab-item.active {
  background-color: var(--n-color-hover);
  border-left-color: var(--n-primary-color);
  color: var(--n-primary-color);
  font-weight: 500;
}

.tools-content {
  flex: 1;
  overflow-y: auto;
  min-width: 0;
  height: 100%;
}

.ai-tools-layout :deep(.n-tab-pane) {
  display: block;
  height: auto;
}

.tool-panel {
  padding: 16px 24px 16px 16px;
  width: 100%;
  box-sizing: border-box;
}

.tool-header-section {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.tool-status {
  display: flex;
  align-items: center;
  gap: 8px;
}

.tool-info {
  margin-bottom: 8px;
}

.website-link {
  color: var(--n-text-color-3);
  font-size: 12px;
  cursor: pointer;
  text-decoration: underline;
}

.website-link:hover {
  color: var(--n-primary-color);
}

.install-section {
  margin-top: 8px;
}

.upgrade-section {
  margin-top: 8px;
}

.uninstall-section {
  margin-top: 8px;
}

.install-command {
  margin-top: 8px;
}

.command-options {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
  padding: 4px 0;
}

.option-label {
  font-size: 12px;
  color: var(--n-text-color-2);
}

.method-label {
  font-size: 12px;
  color: var(--n-text-color-3);
  margin-bottom: 4px;
}

.installed-section {
  margin-top: 8px;
}

.install-terminal-section {
  margin-top: 8px;
}

.install-terminal-wrapper {
  background-color: #1a1a1a;
  border: 1px solid var(--n-border-color);
  border-radius: 6px;
  max-height: 300px;
  min-height: 200px;
  overflow: hidden;
}

.install-terminal-container {
  background-color: #1a1a1a;
  border: 1px solid var(--n-border-color);
  border-radius: 6px;
  max-height: 300px;
  overflow-y: auto;
  padding: 12px;
}

.install-terminal-output {
  font-family: 'Cascadia Code', 'Fira Code', 'Source Code Pro', Menlo, Monaco, 'Courier New', monospace;
  font-size: 12px;
  line-height: 1.5;
  color: #c0c0c0;
  white-space: pre-wrap;
  word-break: break-all;
}

.terminal-text {
  margin: 0;
  padding: 0;
}

.install-terminal-container::-webkit-scrollbar {
  width: 8px;
}

.install-terminal-container::-webkit-scrollbar-track {
  background: #2d2d2d;
}

.install-terminal-container::-webkit-scrollbar-thumb {
  background-color: rgba(128, 128, 128, 0.5);
  border-radius: 4px;
}

.install-terminal-container::-webkit-scrollbar-thumb:hover {
  background-color: rgba(128, 128, 128, 0.8);
}
</style>
