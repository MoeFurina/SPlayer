<!-- 桌面歌词窗口容器组件 -->
<template>
  <!-- 包裹器：用于统一处理鼠标进入/离开事件，包含控制栏和歌词窗口 -->
  <div
    class="desktop-lyrics-wrapper"
    @mouseenter="handleMouseEnterWindow"
    @mouseleave="handleMouseLeaveWindow"
  >
    <!-- 控制栏 - 完全独立于歌词窗口 -->
    <div
      ref="controlBarElement"
      class="control-bar-independent"
      :class="{ 'visible': showControls && !isLocked }"
      @mouseenter="handleControlBarEnter"
      @mouseleave="handleControlBarLeave"
    >
      <!-- 控制按钮 -->
      <DesktopLyricsControls
        :is-locked="isLocked"
        :font-size="fontSize"
        :title-font-size="titleFontSize"
        :tran-font-size="tranFontSize"
        :roma-font-size="romaFontSize"
        :show-yrc="showYrc"
        :window-opacity="windowOpacity"
        :window-background-opacity="windowBackgroundOpacity"
        :control-bar-opacity="controlBarOpacity"
        :auto-lock-enabled="autoLockEnabled"
        :line-spacing="lineSpacing"
        :letter-spacing="letterSpacing"
        @toggle-lock="toggleLock"
        @close="handleClose"
        @title-font-size-change="handleTitleFontSizeChange"
        @spacing-change="handleSpacingChange"
        @font-size-change="handleFontSizeChange"
      />
    </div>

    <!-- 歌词窗口容器 -->
    <div
      :class="['desktop-lyrics-window', { locked: isLocked }]"
      :style="windowStyle"
    >

    <!-- 歌词内容区域 -->
    <div
      ref="lyricsArea"
      class="lyrics-area"
      :class="{ 'draggable': !isLocked }"
      :style="lyricsAreaStyle"
      @mousedown="handleDragStart"
    >
      <DesktopLyricsContent
        :lyrics-data="lyricsData"
        :yrc-data="yrcData"
        :current-index="currentIndex"
        :current-seek="localSeek"
        :is-playing="isPlaying"
        :current-song="currentSong"
        :has-yrc="hasYrc"
        :has-lrc-tran="hasLrcTran"
        :has-lrc-roma="hasLrcRoma"
        :show-yrc="showYrc"
        :show-transl="showTransl"
        :show-roma="showRoma"
        :show-song-info="showSongInfo"
        :show-artist="showArtist"
        :is-locked="isLocked"
        :font-size="fontSize"
        :title-font-size="titleFontSize"
        :tran-font-size="tranFontSize"
        :roma-font-size="romaFontSize"
        :line-spacing="lineSpacing"
        :letter-spacing="letterSpacing"
        :alignment="alignment"
        :scroll-position="scrollPosition"
        :enable-hover-pause="enableHoverPause"
        :enable-click-jump="enableClickJump"
        @lyric-click="handleLyricClick"
        @mouse-enter="handleOpacityMouseEnter"
        @mouse-leave="handleOpacityMouseLeave"
      />
    </div>

    <!-- 大小调整手柄 -->
    <div
      v-if="!isLocked"
      class="resize-handle resize-handle-top"
      @mousedown="handleResizeStart($event, 'top')"
    />
    <div
      v-if="!isLocked"
      class="resize-handle resize-handle-bottom"
      @mousedown="handleResizeStart($event, 'bottom')"
    />
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from "vue";
import { useWindowDragOptimization } from "@/utils/useWindowDrag";
import DesktopLyricsContent from "./DesktopLyricsContent.vue";
import DesktopLyricsControls from "./DesktopLyricsControls.vue";

// 辅助函数：检查 Electron 环境并发送 IPC 消息
const sendIpc = (channel, ...args) => {
  if (typeof window.electron !== "undefined") {
    window.electron.ipcRenderer.send(channel, ...args);
  }
};

// 辅助函数：检查 Electron 环境并调用 IPC invoke
const invokeIpc = (channel, ...args) => {
  if (typeof window.electron !== "undefined") {
    return window.electron.ipcRenderer.invoke(channel, ...args);
  }
  return Promise.resolve(null);
};

// 字号类型映射配置
const fontSizeTypeMap = {
  tranFontSize: 'desktopLyricsTranFontSize',
  romaFontSize: 'desktopLyricsRomaFontSize'
};

// 间距类型映射配置
const spacingTypeMap = {
  lineSpacing: 'desktopLyricsLineSpacing',
  letterSpacing: 'desktopLyricsLetterSpacing'
};

// 数据
const lyricsData = ref([]);
const yrcData = ref([]);
const currentIndex = ref(0);
const currentSeek = ref(0);
const localSeek = ref(0);  // 本地计算的播放进度
const lastSyncSeek = ref(0);  // 上次同步的播放进度
const lastSyncTimestamp = ref(0);  // 上次同步的时间戳
const isPlaying = ref(false);
const currentSong = ref({});
const hasYrc = ref(false);
const hasLrcTran = ref(false);
const hasLrcRoma = ref(false);

// 设置
const isLocked = ref(false);
const showYrc = ref(false);
const showTransl = ref(true);
const showRoma = ref(true);
const showSongInfo = ref(true);
const showArtist = ref(true);
const fontSize = ref(20);
const titleFontSize = ref(15);
const tranFontSize = ref(10);
const romaFontSize = ref(8);
const lineSpacing = ref(40);
const letterSpacing = ref(0);
const alignment = ref("center");
const scrollPosition = ref("center");
const enableHoverPause = ref(true);
const enableClickJump = ref(true);
const windowOpacity = ref(0.8);
const windowBackgroundOpacity = ref(0.6);

// 控制栏显示
const showControls = ref(false);
const controlsTimer = ref(null);

// 透明度交互相关
const currentOpacity = ref(0.9);
const isHoveringForOpacity = ref(false);
const opacityLocked = ref(false);
const hoverStartTime = ref(0);
const hoverThreshold = 300;

// 自动锁定相关
const autoLockEnabled = ref(false);
const autoLockTimer = ref(null);
const AUTO_LOCK_DELAY = 10000; // 自动锁定延迟时间（毫秒）
const MOUSE_LEAVE_CHECK_DELAY = 50; // 鼠标离开检查延迟时间（毫秒）

// 鼠标位置追踪
const isMouseInWindow = ref(false);

// 窗口样式
const windowStyle = computed(() => {
  if (windowBackgroundOpacity.value === 0) {
    return {
      background: "transparent",
      backdropFilter: "none",
      boxShadow: "none",
      border: "none",
    };
  }
  
  return {
    background: isLocked.value ? "transparent" : `rgba(0, 0, 0, ${windowBackgroundOpacity.value})`,
    backdropFilter: isLocked.value ? "none" : undefined,
    boxShadow: isLocked.value ? "none" : undefined,
    border: isLocked.value ? "none" : undefined,
  };
});

// 歌词区域样式
const lyricsAreaStyle = computed(() => ({
  opacity: currentOpacity.value,
  transition: "opacity 0.3s ease",
}));

// 控制栏透明度计算
const controlBarOpacity = computed(() => {
  const opacity = windowBackgroundOpacity.value;
  if (opacity >= 0.6) return 0.8;

  // 线性插值：窗口透明度 [0, 0.6] 映射到控制栏透明度 [0.2, 0.8]
  const ratio = opacity / 0.6;
  return 0.2 + 0.6 * ratio;
});

// Refs
const lyricsArea = ref(null);
const controlBarElement = ref(null);
let rafId = null;

// 本地播放进度计算
const updateLocalSeek = () => {
  if (lastSyncTimestamp.value > 0) {
    const now = Date.now();
    const elapsed = (now - lastSyncTimestamp.value) / 1000;
    localSeek.value = lastSyncSeek.value + elapsed;
  } else {
    localSeek.value = currentSeek.value;
  }
  
  rafId = requestAnimationFrame(updateLocalSeek);
};

// 拖拽相关
let isDragging = false;
let dragStartX = 0;
let dragStartY = 0;

// 大小调整相关
let isResizing = false;
let resizeDirection = "";
let resizeStartY = 0;
let resizeStartHeight = 0;

// 处理拖拽开始
let lastMoveScreenX = 0;
let lastMoveScreenY = 0;
let hasDragged = false;
let dragStartTime = 0;

// 使用 RAF 批处理优化工具
const dragOptimizer = useWindowDragOptimization();

const handleDragStart = (e) => {
  if (isLocked.value || isResizing) return;

  let target = e.target;
  while (target && target !== e.currentTarget) {
    if (target.classList && target.classList.contains("lyric-line")) {
      break;
    }
    target = target.parentElement;
  }

  isDragging = true;
  hasDragged = false;
  dragStartTime = Date.now();
  dragStartX = e.screenX;
  dragStartY = e.screenY;
  lastMoveScreenX = e.screenX;
  lastMoveScreenY = e.screenY;

  // 重置 RAF 批处理状态
  dragOptimizer.reset();

  // 通知主进程拖动开始 (用于初始化缓存)
  sendIpc("desktop-lyrics-window-drag-start", {
    x: e.screenX,
    y: e.screenY,
  });

  document.addEventListener("mousemove", handleDragMove);
  document.addEventListener("mouseup", handleDragEnd);

  // 改变鼠标样式
  document.body.style.cursor = "move";
};

// 处理拖拽移动 - 使用 RAF 批处理优化性能
const handleDragMove = (e) => {
  if (!isDragging) return;

  const deltaX = Math.abs(e.screenX - dragStartX);
  const deltaY = Math.abs(e.screenY - dragStartY);
  const moveThreshold = 5;

  if (deltaX > moveThreshold || deltaY > moveThreshold) {
    hasDragged = true;
  }

  // 计算本次移动的 delta
  const moveDeltaX = e.screenX - lastMoveScreenX;
  const moveDeltaY = e.screenY - lastMoveScreenY;
  lastMoveScreenX = e.screenX;
  lastMoveScreenY = e.screenY;

  // 使用 RAF 批处理累积并发送 delta
  dragOptimizer.accumulateDelta(moveDeltaX, moveDeltaY, (deltaX, deltaY) => {
    sendIpc("desktop-lyrics-window-move", { deltaX, deltaY });
  });
};

// 处理拖拽结束
let clickProtectionTimer = null;
const handleDragEnd = () => {
  isDragging = false;
  document.removeEventListener("mousemove", handleDragMove);
  document.removeEventListener("mouseup", handleDragEnd);
  document.body.style.cursor = "default";

  // 清理并发送剩余的 delta
  dragOptimizer.flush((deltaX, deltaY) => {
    sendIpc("desktop-lyrics-window-move", { deltaX, deltaY });
  });

  // 通知主进程拖动结束 (用于清理缓存)
  sendIpc("desktop-lyrics-window-drag-end");

  if (hasDragged) {
    if (clickProtectionTimer) {
      clearTimeout(clickProtectionTimer);
    }

    clickProtectionTimer = setTimeout(() => {
      clickProtectionTimer = null;
    }, 200);
  }

  hasDragged = false;
};

// 处理大小调整开始
const handleResizeStart = (e, direction) => {
  if (isLocked.value) return;

  e.stopPropagation();
  isResizing = true;
  resizeDirection = direction;
  resizeStartY = e.screenY;

  // 获取当前窗口高度
  invokeIpc("desktop-lyrics-get-state").then((state) => {
    if (state) {
      resizeStartHeight = state.bounds.height;
    }
  });

  document.addEventListener("mousemove", handleResizeMove);
  document.addEventListener("mouseup", handleResizeEnd);
  
  // 改变鼠标样式
  document.body.style.cursor = "ns-resize";
};

// 处理大小调整移动
const handleResizeMove = (e) => {
  if (!isResizing) return;
  
  const deltaY = e.screenY - resizeStartY;
  let newHeight = resizeStartHeight;
  
  if (resizeDirection === "top") {
    newHeight = resizeStartHeight - deltaY;
  } else if (resizeDirection === "bottom") {
    newHeight = resizeStartHeight + deltaY;
  }
  
  newHeight = Math.max(newHeight, 34);

  // 发送窗口大小调整消息到主进程
  sendIpc("desktop-lyrics-window-resize", {
    height: newHeight,
    direction: resizeDirection,
  });
};

// 处理大小调整结束
const handleResizeEnd = () => {
  isResizing = false;
  resizeDirection = "";
  document.removeEventListener("mousemove", handleResizeMove);
  document.removeEventListener("mouseup", handleResizeEnd);
  document.body.style.cursor = "default";
};

// 检查是否应该启动自动锁定定时器
const shouldStartAutoLockTimer = () => {
  return autoLockEnabled.value && !isLocked.value && !isMouseInWindow.value;
};

// 启动自动锁定定时器
const startAutoLockTimer = () => {
  cancelAutoLockTimer();

  autoLockTimer.value = setTimeout(() => {
    if (!isLocked.value) {
      isLocked.value = true;
      sendIpc("desktop-lyrics-set-locked", true);
    }
  }, AUTO_LOCK_DELAY);
};

// 取消自动锁定定时器
const cancelAutoLockTimer = () => {
  if (autoLockTimer.value) {
    clearTimeout(autoLockTimer.value);
    autoLockTimer.value = null;
  }
};

// 切换锁定状态
const toggleLock = () => {
  isLocked.value = !isLocked.value;
  sendIpc("desktop-lyrics-set-locked", isLocked.value);

  if (isLocked.value) {
    showControls.value = false;
  }
};

// 关闭窗口
const handleClose = () => {
  sendIpc("desktop-lyrics-hide");
};

// 处理作品信息字号变化
const handleTitleFontSizeChange = (newSize) => {
  titleFontSize.value = newSize;
  sendIpc("desktop-lyrics-save-setting", {
    key: "desktopLyricsTitleFontSize",
    value: newSize,
  });
};

// 字号变化处理
const handleFontSizeChange = (type, value) => {
  if (type === 'tranFontSize') {
    tranFontSize.value = value;
  } else if (type === 'romaFontSize') {
    romaFontSize.value = value;
  }

  sendIpc("desktop-lyrics-control", {
    action: type,
    value: value,
  });

  sendIpc("desktop-lyrics-save-setting", {
    key: fontSizeTypeMap[type],
    value: value,
  });
};

// 间距变化处理
const handleSpacingChange = (type, value) => {
  if (type === 'lineSpacing') {
    lineSpacing.value = value;
  } else if (type === 'letterSpacing') {
    letterSpacing.value = value;
  }

  sendIpc("desktop-lyrics-control", {
    action: type,
    value: value,
  });

  sendIpc("desktop-lyrics-save-setting", {
    key: spacingTypeMap[type],
    value: value,
  });
};

// 辅助函数：清除控制栏定时器
const clearControlsTimer = () => {
  if (controlsTimer.value) {
    clearTimeout(controlsTimer.value);
    controlsTimer.value = null;
  }
};

// 鼠标进入窗口（包裹器）
const handleMouseEnterWindow = () => {
  isMouseInWindow.value = true;
  cancelAutoLockTimer();
};

// 鼠标离开窗口（包裹器）
const handleMouseLeaveWindow = () => {
  isMouseInWindow.value = false;

  // 发送鼠标离开消息，触发主窗口自动聚焦（只在未锁定状态下）
  if (!isLocked.value) {
    sendIpc("desktop-lyrics-mouse-leave");
  }

  // 延迟检查是否需要启动自动锁定定时器
  setTimeout(() => {
    if (shouldStartAutoLockTimer()) {
      startAutoLockTimer();
    }
  }, MOUSE_LEAVE_CHECK_DELAY);
};

// 控制栏鼠标移入
const handleControlBarEnter = () => {
  showControls.value = true;
  clearControlsTimer();
};

// 控制栏鼠标移出
const handleControlBarLeave = () => {
  showControls.value = false;
};

// 鼠标移入透明度交互
const handleOpacityMouseEnter = () => {
  if (!isLocked.value) return;

  hoverStartTime.value = Date.now();
  isHoveringForOpacity.value = true;

  if (!opacityLocked.value) {
    // 根据窗口透明度动态计算悬停透明度
    const targetOpacity = windowOpacity.value > 0.6 ? 0.06 : 0.02;
    currentOpacity.value = targetOpacity;
  }
};

// 鼠标移出透明度交互
const handleOpacityMouseLeave = () => {
  if (!isLocked.value) return;

  const hoverDuration = Date.now() - hoverStartTime.value;
  isHoveringForOpacity.value = false;

  if (hoverDuration < hoverThreshold && hoverDuration > 0) {
    opacityLocked.value = !opacityLocked.value;
  }

  if (!opacityLocked.value) {
    currentOpacity.value = windowOpacity.value;
  }

  hoverStartTime.value = 0;
};

// 点击歌词跳转
const handleLyricClick = (time) => {
  if (clickProtectionTimer) {
    return;
  }

  sendIpc("desktop-lyrics-control", {
    action: "seek",
    value: time,
  });
};

// 监听主进程发来的数据更新
const setupIpcListeners = () => {
  if (typeof window.electron !== "undefined") {

  // 播放状态更新
  window.electron.ipcRenderer.on("play-state-updated", (_, data) => {
    currentIndex.value = data.lyricIndex || 0;
    currentSeek.value = data.seek || 0;

    // 更新同步时间戳和播放进度，用于本地计算
    lastSyncSeek.value = data.seek || 0;
    lastSyncTimestamp.value = data.timestamp || Date.now();

    isPlaying.value = data.isPlaying || false;
  });

    // 歌词数据更新
    window.electron.ipcRenderer.on("lyric-data-updated", (_, data) => {
      lyricsData.value = data.lrc || [];
      yrcData.value = data.yrc || [];
      hasYrc.value = data.hasYrc || false;
      hasLrcTran.value = data.hasLrcTran || false;
      hasLrcRoma.value = data.hasLrcRoma || false;
    });

    // 歌曲信息更新
    window.electron.ipcRenderer.on("song-info-updated", (_, data) => {
      currentSong.value = data;
    });

    // 设置更新 - 使用配置映射简化逻辑
    window.electron.ipcRenderer.on("settings-updated", (_, settings) => {

      // 设置映射表：[设置键, 本地ref]
      const settingMappings = [
        ['desktopLyricsShowTitle', showSongInfo],
        ['desktopLyricsShowArtist', showArtist],
        ['desktopLyricsFontSize', fontSize],
        ['desktopLyricsTitleFontSize', titleFontSize],
        ['desktopLyricsTranFontSize', tranFontSize],
        ['desktopLyricsRomaFontSize', romaFontSize],
        ['desktopLyricsAlignment', alignment],
        ['desktopLyricsHoverPause', enableHoverPause],
        ['desktopLyricsClickJump', enableClickJump],
        ['desktopLyricsOpacity', windowOpacity],
        ['desktopLyricsWindowOpacity', windowBackgroundOpacity],
        ['desktopLyricsLineSpacing', lineSpacing],
        ['desktopLyricsLetterSpacing', letterSpacing],
        ['showTransl', showTransl],
        ['showRoma', showRoma],
      ];

      // 批量更新设置
      settingMappings.forEach(([key, ref]) => {
        if (settings[key] !== undefined) {
          ref.value = settings[key];
        }
      });

      // 滚动位置固定为 center
      if (settings.desktopLyricsScrollPosition !== undefined) {
        scrollPosition.value = "center";
      }

      // 逐字歌词开关（有默认值）
      showYrc.value = settings.showYrc !== undefined ? settings.showYrc : false;

      // 自动锁定（需要启动/取消定时器）
      if (settings.desktopLyricsAutoLock !== undefined) {
        const oldValue = autoLockEnabled.value;
        autoLockEnabled.value = settings.desktopLyricsAutoLock;

        if (oldValue !== autoLockEnabled.value) {
          if (autoLockEnabled.value) {
            if (shouldStartAutoLockTimer()) {
              startAutoLockTimer();
            }
          } else {
            cancelAutoLockTimer();
          }
        }
      }
    });

    // 锁定状态变化
    window.electron.ipcRenderer.on("desktop-lyrics-lock-changed", (_, data) => {
      isLocked.value = data;
    });

    // 间距调节指令
    window.electron.ipcRenderer.on("desktop-lyrics-control", (_, action) => {
      if (action.action === 'lineSpacing') {
        lineSpacing.value = action.value;
      } else if (action.action === 'letterSpacing') {
        letterSpacing.value = action.value;
      }
    });
  }
};

// 监听设置变化，更新透明度
watch(
  () => windowOpacity.value,
  (newOpacity) => {
    if (!isHoveringForOpacity.value && !opacityLocked.value) {
      currentOpacity.value = newOpacity;
    }
  },
  { immediate: true }
);

// 处理锁定状态变化时的透明度交互
const handleOpacityOnLockChange = (isLocked) => {
  if (!isLocked) {
    opacityLocked.value = false;
    isHoveringForOpacity.value = false;
    currentOpacity.value = windowOpacity.value;
  } else if (!isHoveringForOpacity.value) {
    currentOpacity.value = windowOpacity.value;
  }
};

// 处理锁定状态变化时的自动锁定定时器
const handleAutoLockTimerOnLockChange = (isLocked) => {
  if (isLocked) {
    cancelAutoLockTimer();
  } else if (shouldStartAutoLockTimer()) {
    startAutoLockTimer();
  }
};

// 锁定状态变化时重置透明度交互和处理自动锁定定时器
watch(
  () => isLocked.value,
  (newLocked, oldLocked) => {
    if (oldLocked === newLocked || oldLocked === undefined) return;

    handleOpacityOnLockChange(newLocked);
    handleAutoLockTimerOnLockChange(newLocked);
  }
);

onMounted(() => {
  currentOpacity.value = windowOpacity.value;
  
  setupIpcListeners();
  
  rafId = requestAnimationFrame(updateLocalSeek);
  
  showControls.value = true;

  if (shouldStartAutoLockTimer()) {
    startAutoLockTimer();
  }

  // 立即发送设置同步请求
  sendIpc("desktop-lyrics-sync-settings");

  // 延迟发送数据同步请求，确保主窗口准备就绪
  setTimeout(() => {
    sendIpc("desktop-lyrics-sync-song-info");
    sendIpc("desktop-lyrics-sync-lyric-data");
  }, 500);
  
  setTimeout(() => {
    hideControlsDelayed();
  }, 5000);
});

onUnmounted(() => {
  // 清理所有定时器
  clearControlsTimer();
  cancelAutoLockTimer();

  // 清理动画帧
  if (rafId) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }

  // 清理事件监听器
  document.removeEventListener("mousemove", handleDragMove);
  document.removeEventListener("mouseup", handleDragEnd);
  document.removeEventListener("mousemove", handleResizeMove);
  document.removeEventListener("mouseup", handleResizeEnd);
});
</script>

<style lang="scss" scoped>
// 包裹器：用于统一处理鼠标进入/离开事件
.desktop-lyrics-wrapper {
  width: 100vw;
  height: 100vh;
  position: relative;
}

// 独立的控制栏 - 完全独立于歌词窗口
.control-bar-independent {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 10000; // 最高层级
  padding: 0;
  background: transparent;
  pointer-events: auto; // 始终可交互
  user-select: none; // 禁用选中功能

  // 默认状态下控制按钮透明
  :deep(.desktop-lyrics-controls) {
    pointer-events: auto;
    margin: 0;
    border-radius: 0;
    opacity: 0; // 默认透明
    transition: opacity 0.2s ease; // 添加过渡效果
  }

  // 可见状态下显示控制按钮
  &.visible {
    :deep(.desktop-lyrics-controls) {
      opacity: 1; // 显示
    }
  }
}

.desktop-lyrics-window {
  width: 100vw;
  height: 100vh;
  display: flex;
  flex-direction: column;
  backdrop-filter: blur(15px);
  -webkit-backdrop-filter: blur(15px);
  box-shadow: 0 0 20px rgba(0, 0, 0, 0.5); /* 添加阴影增强可见度 */
  position: relative;
  overflow: hidden;
  border: none;
  user-select: none; // 禁用所有元素的选中功能

  // 歌词区域
  .lyrics-area {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 1;
    
    &.draggable {
      cursor: move;
    }
  }

  // 大小调整手柄
  .resize-handle {
    position: absolute;
    left: 0;
    right: 0;
    height: 8px;
    cursor: ns-resize;
    z-index: 10;
    
    &::before {
      display: none;
    }
    
    &:hover::before {
      display: none;
    }
    
    &.resize-handle-top {
      top: 0;
    }
    
    &.resize-handle-bottom {
      bottom: 0;
    }
  }
}
</style>