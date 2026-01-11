<!--
 Rebebuca
 Copyright (C) 2025 rebebuca contributors
 
 This program is free software: you can redistribute it and/or modify
 it under the terms of the GNU General Public License as published by
 the Free Software Foundation, either version 3 of the License, or
 (at your option) any later version.
 
 This program is distributed in the hope that it will be useful,
 but WITHOUT ANY WARRANTY; without even the implied warranty of
 MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 GNU General Public License for more details.
 
 You should have received a copy of the GNU General Public License
 along with this program.  If not, see <https://www.gnu.org/licenses/>.
-->

<template>
  <n-popover
    trigger="click"
    placement="bottom"
    :show="show"
    @update:show="$emit('update:show', $event)"
  >
    <template #trigger>
      <n-button size="small" quaternary>
        <template #icon>
          <n-icon size="16">
            <slot name="icon">
              <component :is="currentIcon || (() => h('span', '?'))" />
            </slot>
          </n-icon>
        </template>
      </n-button>
    </template>
    <div class="icon-picker">
      <div class="icon-picker-header">
        <n-input
          v-model:value="searchQuery"
          size="small"
          :placeholder="t('settings.searchIcons')"
          clearable
        />
      </div>
      <div class="icon-picker-grid">
        <template v-for="(icon, name) in filteredIcons" :key="name">
          <n-tooltip
            v-if="icon"
            trigger="hover"
            :delay="500"
          >
            <template #trigger>
              <div
                class="icon-picker-item"
                :class="{ 'icon-picker-item-selected': name === modelValue }"
                @click="selectIcon(name as string)"
              >
                <n-icon size="20">
                  <component :is="icon" />
                </n-icon>
              </div>
            </template>
            {{ name }}
          </n-tooltip>
        </template>
      </div>
    </div>
  </n-popover>
</template>

<script setup lang="ts">
import { computed, ref, h, type Component } from 'vue';
import { NPopover, NButton, NIcon, NInput, NTooltip } from 'naive-ui';
import { useI18n } from 'vue-i18n';
import { svgIcons } from '../utils/icons';
// Import xicons
import {
  Terminal,
  Code,
  Server,
  Cloud,
  Rocket,
  Bug,
  Hammer,
  Cube,
  Flask,
  Cog,
  Flash,
  ServerOutline,
  Globe,
  Wifi,
  LockClosed,
  Key,
  Eye,
  Heart,
  Star,
  Flag,
  Bookmark,
  Pricetag,
  Briefcase,
  Calendar,
  Time,
  Timer,
  Hourglass,
  Pulse,
  Analytics,
  TrendingUp,
  Speedometer,
  Layers,
  Apps,
  GridOutline,
  Menu,
  Home,
  Person,
  People,
  Mail,
  Send,
  Attach,
  Link,
  Share,
  Download,
  CloudUpload,
  CloudDownload,
  Sync,
  Refresh,
  Play,
  Pause,
  Stop,
  Power,
  Warning,
  Alert,
  InformationCircle,
  CheckmarkCircle,
  CloseCircle,
  AddCircle,
  RemoveCircle,
  Create,
  Trash,
  Copy,
  Cut,
  Save,
  DocumentText,
  Folder,
  FolderOpen,
  Archive,
  Image,
  Camera,
  Videocam,
  Mic,
  VolumeHigh,
  Bluetooth,
  Cellular,
  BatteryFull,
  Thermometer,
  Water,
  Flame,
  Snow,
  Sunny,
  Moon,
  Cloudy,
  Rainy,
  Thunderstorm,
  Leaf,
  Flower,
  Earth,
  Planet,
  Telescope,
  Compass,
  Map,
  Navigate,
  Car,
  Airplane,
  Boat,
  Train,
  Bus,
  Bicycle,
  Walk,
  Footsteps,
  Fitness,
  Barbell,
  Football,
  Basketball,
  Baseball,
  Golf,
  GameController,
  Dice,
  Trophy,
  Medal,
  Ribbon,
  Gift,
  Cart,
  Wallet,
  Card,
  Cash,
  Calculator,
  Print,
  Scan,
  QrCode,
  Barcode,
  HandLeft,
  ThumbsUp,
  Sparkles,
  ColorPalette,
  Brush,
  Pencil,
  Build,
  Construct,
  ExtensionPuzzle,
  Pizza,
  Cafe,
  Beer,
  Wine,
  Restaurant,
  Nutrition,
  Medkit,
  Bandage,
  School,
  Library,
  Book,
  Newspaper,
  Reader,
  Glasses,
  Headset,
  Watch,
  Shirt
} from '@vicons/ionicons5';

const { t } = useI18n();

interface Props {
  modelValue?: string;
  show?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: 'task',
  show: false,
});

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void;
  (e: 'update:show', value: boolean): void;
}>();

const searchQuery = ref('');

// xicons 图标集合
const xicons: Record<string, Component> = {
  terminal: Terminal,
  code: Code,
  server: Server,
  cloud: Cloud,
  rocket: Rocket,
  bug: Bug,
  hammer: Hammer,
  cube: Cube,
  flask: Flask,
  cog: Cog,
  flash: Flash,
  database: ServerOutline,
  globe: Globe,
  wifi: Wifi,
  lock: LockClosed,
  key: Key,
  eye: Eye,
  heart: Heart,
  star: Star,
  flag: Flag,
  bookmark: Bookmark,
  tag: Pricetag,
  briefcase: Briefcase,
  calendar: Calendar,
  clock: Time,
  timer: Timer,
  hourglass: Hourglass,
  pulse: Pulse,
  analytics: Analytics,
  trendingUp: TrendingUp,
  speedometer: Speedometer,
  layers: Layers,
  apps: Apps,
  grid: GridOutline,
  menu: Menu,
  home: Home,
  person: Person,
  people: People,
  mail: Mail,
  send: Send,
  attach: Attach,
  link: Link,
  share: Share,
  download: Download,
  cloudUpload: CloudUpload,
  cloudDownload: CloudDownload,
  sync: Sync,
  refresh: Refresh,
  play: Play,
  pause: Pause,
  stop: Stop,
  power: Power,
  warning: Warning,
  alert: Alert,
  info: InformationCircle,
  checkmark: CheckmarkCircle,
  close: CloseCircle,
  add: AddCircle,
  remove: RemoveCircle,
  create: Create,
  trash: Trash,
  copy: Copy,
  cut: Cut,
  save: Save,
  document: DocumentText,
  folder: Folder,
  folderOpen: FolderOpen,
  archive: Archive,
  image: Image,
  camera: Camera,
  videocam: Videocam,
  mic: Mic,
  volume: VolumeHigh,
  bluetooth: Bluetooth,
  cellular: Cellular,
  battery: BatteryFull,
  thermometer: Thermometer,
  water: Water,
  flame: Flame,
  snow: Snow,
  sunny: Sunny,
  moon: Moon,
  cloudy: Cloudy,
  rainy: Rainy,
  thunderstorm: Thunderstorm,
  leaf: Leaf,
  flower: Flower,
  earth: Earth,
  planet: Planet,
  telescope: Telescope,
  compass: Compass,
  map: Map,
  navigate: Navigate,
  car: Car,
  airplane: Airplane,
  boat: Boat,
  train: Train,
  bus: Bus,
  bicycle: Bicycle,
  walk: Walk,
  footsteps: Footsteps,
  fitness: Fitness,
  barbell: Barbell,
  football: Football,
  basketball: Basketball,
  baseball: Baseball,
  golf: Golf,
  gameController: GameController,
  dice: Dice,
  trophy: Trophy,
  medal: Medal,
  ribbon: Ribbon,
  gift: Gift,
  cart: Cart,
  pricetag: Pricetag,
  wallet: Wallet,
  card: Card,
  cash: Cash,
  calculator: Calculator,
  print: Print,
  scan: Scan,
  qrCode: QrCode,
  barcode: Barcode,
  hand: HandLeft,
  thumbsUp: ThumbsUp,
  sparkles: Sparkles,
  colorPalette: ColorPalette,
  brush: Brush,
  pencil: Pencil,
  build: Build,
  construct: Construct,
  extension: ExtensionPuzzle,
  pizza: Pizza,
  cafe: Cafe,
  beer: Beer,
  wine: Wine,
  restaurant: Restaurant,
  nutrition: Nutrition,
  medkit: Medkit,
  bandage: Bandage,
  school: School,
  library: Library,
  book: Book,
  newspaper: Newspaper,
  reader: Reader,
  glasses: Glasses,
  headset: Headset,
  watch: Watch,
  shirt: Shirt,
};

// 合并所有图标
const allIcons = computed(() => {
  return { ...svgIcons, ...xicons };
});

const currentIcon = computed(() => {
  const iconName = props.modelValue || 'task';
  // 先检查 xicons
  if (iconName && iconName in xicons) {
    const icon = xicons[iconName as keyof typeof xicons];
    if (icon) return icon;
  }
  // 再检查 svgIcons
  if (iconName && iconName in svgIcons) {
    const icon = svgIcons[iconName as keyof typeof svgIcons];
    if (icon) return icon;
  }
  // 确保总是返回一个有效的图标（使用 svgIcons.task 作为最终回退）
  const fallback = svgIcons.task;
  if (!fallback) {
    // 如果 svgIcons.task 不存在，返回一个简单的占位符组件
    console.warn('[IconPicker] svgIcons.task is not available, using fallback');
    return () => h('span', '?');
  }
  return fallback;
});

const filteredIcons = computed(() => {
  const query = searchQuery.value.toLowerCase();
  const icons = allIcons.value;
  if (!query) return icons;
  
  return Object.fromEntries(
    Object.entries(icons).filter(([name]) => 
      name.toLowerCase().includes(query)
    )
  );
});

const selectIcon = (name: string) => {
  emit('update:modelValue', name);
  emit('update:show', false);
};
</script>

<style scoped>
.icon-picker {
  width: 320px;
  max-height: 400px;
  display: flex;
  flex-direction: column;
}

.icon-picker-header {
  padding-bottom: 8px;
  border-bottom: 1px solid var(--n-border-color);
  margin-bottom: 8px;
}

.icon-picker-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 4px;
  overflow-y: auto;
  padding: 4px;
}

.icon-picker-item {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.icon-picker-item:hover {
  background-color: var(--n-color-hover);
}

.icon-picker-item-selected {
  background-color: var(--n-color-pressed);
  outline: 2px solid var(--n-color-target);
}
</style>
