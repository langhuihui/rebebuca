# Rebebuca 多语言支持

## 功能介绍

Rebebuca 现在支持多语言功能，包括：

- **自动检测系统语言**：应用启动时会自动检测操作系统语言并切换到对应的语言
- **支持的语言**：
  - 简体中文 (zh-CN)
  - English (en)

## 系统语言检测

应用会自动检测浏览器/系统语言设置：
- 如果检测到中文语言环境（zh-*），将使用简体中文
- 其他语言环境默认使用英文

语言偏好会保存在浏览器的 localStorage 中，下次打开应用时会记住你的选择。

## 手动切换语言

如果你想在代码中手动切换语言，可以使用提供的 `useLocale` composable：

```typescript
import { useLocale } from '@/composables/useLocale';

// 在组件中使用
const { currentLocale, setLocale, toggleLocale, availableLocales } = useLocale();

// 切换到英文
setLocale('en');

// 切换到中文
setLocale('zh-CN');

// 在中英文之间切换
toggleLocale();
```

## 添加新的翻译

翻译文件位于 `src/locales/` 目录：

1. **英文翻译**: `src/locales/en.ts`
2. **中文翻译**: `src/locales/zh-CN.ts`

### 添加新的翻译键：

1. 在 `en.ts` 和 `zh-CN.ts` 中添加对应的键值对
2. 在组件中使用 `t()` 函数引用：

```vue
<template>
  <div>{{ t('yourKey.subKey') }}</div>
</template>

<script setup>
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
</script>
```

## 添加新的语言

如果要添加新的语言支持：

1. 在 `src/locales/` 目录创建新的语言文件，例如 `ja.ts`（日语）
2. 在 `src/locales/index.ts` 中导入并添加到 messages 对象
3. 更新 `getSystemLocale()` 函数以支持新语言的检测
4. 在 `src/composables/useLocale.ts` 的 `availableLocales` 数组中添加新语言

## 技术栈

- **vue-i18n v9**: Vue.js 的国际化插件
- **Composition API**: 使用 Vue 3 的 Composition API
- **localStorage**: 持久化语言偏好设置

