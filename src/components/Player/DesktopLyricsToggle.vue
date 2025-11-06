<!-- 桌面歌词切换按钮 -->
<template>
  <n-tooltip 
    :show-arrow="false" 
    trigger="hover" 
    placement="top"
    :delay="500"
    raw
    :theme-overrides="tooltipTheme"
  >
    <template #trigger>
      <n-icon
        :class="['desktop-lyrics-toggle', { active: desktopLyricsEnabled }]"
        size="20"
        @click="toggleDesktopLyrics"
        @contextmenu="handleRightClick"
      >
        <SvgIcon icon="desktop-lyrics" size="20" />
      </n-icon>
    </template>
    <span>{{ getTooltipText() }}</span>
  </n-tooltip>
</template>

<script setup>
import { storeToRefs } from "pinia";
import { siteSettings } from "@/stores";
import SvgIcon from "@/components/Global/SvgIcon.vue";
import { ref, onMounted, onUnmounted, computed } from "vue";
import { toggleDesktopLyrics as toggleDesktopLyricsSync, forceClearDesktopLyricsEnabled } from "@/utils/desktopLyricsSync";

const settings = siteSettings();
const { desktopLyricsEnabled, desktopLyricsRightClickToggleLock } = storeToRefs(settings);
const isLocked = ref(false);

// Tooltip主题配置
const tooltipTheme = {
  color: '#333',
  textColor: '#fff',
  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.2)',
  fontSize: '11px',
  padding: '4px 8px',
  borderRadius: '2px'
};

// 获取动态提示文本
const getTooltipText = () => {
  if (desktopLyricsEnabled.value) {
    const lockText = isLocked.value ? '解锁' : '锁定';
    return `关闭桌面歌词(右击${lockText}桌面歌词)`;
  }
  return '开启桌面歌词';
};

// 切换桌面歌词
const toggleDesktopLyrics = () => toggleDesktopLyricsSync();

// 右击处理
const handleRightClick = (e) => {
  e.preventDefault();
  if (desktopLyricsRightClickToggleLock.value) {
    if (desktopLyricsEnabled.value) {
      window.electron?.ipcRenderer.send("desktop-lyrics-toggle-lock");
    } else {
      toggleDesktopLyricsSync();
      setTimeout(() => window.electron?.ipcRenderer.send("desktop-lyrics-toggle-lock"), 100);
    }
  }
};

// IPC事件处理
const handleEvents = {
  "desktop-lyrics-error": (_, data) => {
    if (desktopLyricsEnabled.value) forceClearDesktopLyricsEnabled();
    window.$message?.error(`桌面歌词错误: ${data.message || "未知错误"}`);
  },
  "desktop-lyrics-lock-changed": (_, locked) => isLocked.value = locked
};

onMounted(async () => {
  if (window.electron) {
    Object.entries(handleEvents).forEach(([event, handler]) => {
      window.electron.ipcRenderer.on(event, handler);
    });
    try {
      isLocked.value = await window.electron.ipcRenderer.invoke("desktop-lyrics-get-lock-status");
    } catch (error) {
      console.error("获取锁定状态失败:", error);
    }
  }
});

onUnmounted(() => {
  if (window.electron) {
    Object.keys(handleEvents).forEach(event => {
      window.electron.ipcRenderer.removeListener(event, handleEvents[event]);
    });
  }
});
</script>

<style lang="scss" scoped>
.desktop-lyrics-toggle {
  margin-left: 8px;
  padding: 8px;
  border-radius: 8px;
  color: var(--main-color);
  transition: background-color 0.3s, transform 0.3s, opacity 0.1s ease-in-out;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  
  &:hover {
    transform: scale(1.1);
    background-color: var(--main-second-color);
  }
  
  &:active {
    transform: scale(1);
  }
  
  &.active {
    color: var(--main-color);
    background: transparent;
    
    &:hover {
      background-color: var(--main-second-color);
    }
  }
  
  :deep(.svg-icon) {
    width: 22px;
    height: 22px;
    transition: opacity 0.1s;
  }
}

// Tooltip样式
:deep(.n-tooltip),
:global(.n-tooltip) {
  background: #333 !important;
  color: #fff !important;
  padding: 6px 10px !important;
  font-size: 12px !important;
  border-radius: 4px !important;
}
</style>
