<!-- 桌面歌词切换按钮 -->
<template>
  <button
    :class="['desktop-lyrics-toggle', { active: desktopLyricsEnabled, loading }]"
    :title="desktopLyricsEnabled ? '关闭桌面歌词' : '开启桌面歌词'"
    @click="toggleDesktopLyrics"
    @contextmenu="handleRightClick"
    :disabled="loading"
  >
    <SvgIcon v-if="!loading" icon="desktop-lyrics" size="20" />
    <span v-else class="loading-indicator"></span>
  </button>
</template>

<script setup>
import { storeToRefs } from "pinia";
import { siteSettings } from "@/stores";
import SvgIcon from "@/components/Global/SvgIcon.vue";
import { ref, onMounted, onUnmounted } from "vue";

const settings = siteSettings();
const { desktopLyricsEnabled, desktopLyricsRightClickToggleLock } = storeToRefs(settings);
const loading = ref(false);

// 切换桌面歌词
const toggleDesktopLyrics = () => {
  loading.value = true;
  
  // 延时以便反馈加载状态
  setTimeout(() => {
    settings.toggleDesktopLyrics();
    
    // 设置超时，如果桌面歌词窗口没有正确响应，重置状态
    setTimeout(() => {
      loading.value = false;
    }, 2000); // 2秒后重置，通常窗口创建不会超过这个时间
  }, 200);
};

// 右击切换锁定状态
const handleRightClick = (e) => {
  e.preventDefault();
  
  // 检查设置是否启用右击切换锁定
  if (desktopLyricsRightClickToggleLock.value) {
    // 设置开启：切换锁定状态
    if (desktopLyricsEnabled.value) {
      toggleDesktopLyricsLock();
    } else {
      // 如果桌面歌词未开启，先开启再锁定
      settings.toggleDesktopLyrics();
      setTimeout(() => {
        toggleDesktopLyricsLock();
      }, 100);
    }
  } else {
    // 设置关闭：显示右键菜单或其他功能
    showContextMenu(e);
  }
};

// 切换桌面歌词锁定状态
const toggleDesktopLyricsLock = () => {
  if (typeof window.electron !== "undefined") {
    window.electron.ipcRenderer.send("desktop-lyrics-toggle-lock");
  }
};

// 显示右键菜单（设置关闭时的行为）
const showContextMenu = (e) => {
  // 可以显示一个简单的右键菜单
  // 或者执行其他功能
  console.log("右击功能已禁用，显示菜单或其他功能");
};

// 监听桌面歌词错误事件
const handleDesktopLyricsError = (_, data) => {
  console.error("桌面歌词错误:", data);
  loading.value = false;
  
  // 如果是开启失败，重置状态
  if (desktopLyricsEnabled.value) {
    settings.forceClearDesktopLyricsEnabled();
  }
  
  // 显示错误消息
  if (window.$message) {
    window.$message.error(`桌面歌词错误: ${data.message || "未知错误"}`);
  }
};

// 监听桌面歌词窗口已显示事件
const handleDesktopLyricsShown = () => {
  console.log("桌面歌词窗口已显示");
  loading.value = false;
};

// 监听桌面歌词窗口已隐藏事件
const handleDesktopLyricsClosed = () => {
  console.log("桌面歌词窗口已隐藏");
  loading.value = false;
};

onMounted(() => {
  if (typeof window.electron !== "undefined") {
    window.electron.ipcRenderer.on("desktop-lyrics-error", handleDesktopLyricsError);
    window.electron.ipcRenderer.on("desktop-lyrics-shown", handleDesktopLyricsShown);
    window.electron.ipcRenderer.on("desktop-lyrics-closed", handleDesktopLyricsClosed);
  }
});

onUnmounted(() => {
  if (typeof window.electron !== "undefined") {
    window.electron.ipcRenderer.removeListener("desktop-lyrics-error", handleDesktopLyricsError);
    window.electron.ipcRenderer.removeListener("desktop-lyrics-shown", handleDesktopLyricsShown);
    window.electron.ipcRenderer.removeListener("desktop-lyrics-closed", handleDesktopLyricsClosed);
  }
});
</script>

<style lang="scss" scoped>
.desktop-lyrics-toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: none;
  background: transparent;
  border-radius: 8px;
  cursor: pointer;
  color: var(--text-color);
  transition: all 0.3s;
  
  &:hover {
    background: var(--hover-bg-color);
    transform: scale(1.05);
  }
  
  &:active {
    transform: scale(0.95);
  }
  
  &.active {
    color: var(--primary-color);
    background: var(--primary-color-hover);
  }
  
  &:disabled {
    cursor: wait;
    opacity: 0.7;
    transform: none;
  }
  
  &.loading {
    position: relative;
    
    .loading-indicator {
      display: inline-block;
      width: 16px;
      height: 16px;
      border: 2px solid rgba(255, 255, 255, 0.3);
      border-radius: 50%;
      border-top-color: var(--primary-color);
      animation: spin 1s linear infinite;
      position: absolute;
      top: calc(50% - 8px);
      left: calc(50% - 8px);
    }
  }
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
</style>
