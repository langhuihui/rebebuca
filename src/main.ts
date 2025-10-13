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

import { createApp } from 'vue';
import App from './App.vue';
import { createPinia } from 'pinia';
import hljs from 'highlight.js';
import 'highlight.js/styles/github-dark.css';
import i18n from './locales';

// Naive UI
import {
  create,
  NButton,
  NConfigProvider,
  NLayout,
  NLayoutHeader,
  NLayoutSider,
  NLayoutContent,
  NSpace,
  NIcon,
  NDivider,
  NScrollbar,
  NH3,
  NList,
  NListItem,
  NThing,
  NEllipsis,
  NText,
  NGrid,
  NGi,
  NCard,
  NLog,
  NTimeline,
  NTimelineItem,
  NButtonGroup,
  NMessageProvider,
  NModal,
  NForm,
  NFormItem,
  NInput,
  NDynamicInput,
  NInputGroup,
  NCode
} from 'naive-ui';

const naive = create({
  components: [
    NButton,
    NConfigProvider,
    NLayout,
    NLayoutHeader,
    NLayoutSider,
    NLayoutContent,
    NSpace,
    NIcon,
    NDivider,
    NScrollbar,
    NH3,
    NList,
    NListItem,
    NThing,
    NEllipsis,
    NText,
    NGrid,
    NGi,
    NCard,
    NLog,
    NTimeline,
    NTimelineItem,
    NButtonGroup,
    NMessageProvider,
    NModal,
    NForm,
    NFormItem,
    NInput,
    NDynamicInput,
    NInputGroup,
    NCode
  ]
});

const app = createApp(App);
const pinia = createPinia();

// Configure hljs for code highlighting
hljs.configure({
  ignoreUnescapedHTML: true
});
app.provide('hljs', hljs);

app.use(naive);
app.use(pinia);
app.use(i18n);
app.mount('#app');