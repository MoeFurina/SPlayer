<!-- 桌面歌词窗口容器组件 -->
<template>
  <div
    :class="['desktop-lyrics-window', { locked: isLocked }]"
    :style="windowStyle"
  >
    <!-- 控制栏 -->
    <div
      v-show="showControls"
      class="control-bar"
      @mouseenter="handleControlBarEnter"
      @mouseleave="handleControlBarLeave"
    >
      <!-- 控制按钮 -->
      <DesktopLyricsControls
        :is-locked="isLocked"
        :font-size="fontSize"
        @toggle-lock="toggleLock"
        @close="handleClose"
      />
    </div>

    <!-- 歌词内容区域 -->
    <div
      ref="lyricsArea"
      class="lyrics-area"
      :class="{ 'draggable': !isLocked }"
      @mousedown="handleDragStart"
      @mouseenter="handleLyricsEnter"
      @mouseleave="handleLyricsLeave"
    >
      <DesktopLyricsContent
        :lyrics-data="lyricsData"
        :current-index="currentIndex"
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
        :alignment="alignment"
        :scroll-position="scrollPosition"
        :enable-hover-pause="enableHoverPause"
        :enable-click-jump="enableClickJump"
        @lyric-click="handleLyricClick"
        @mouse-enter="handleContentMouseEnter"
        @mouse-leave="handleContentMouseLeave"
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
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from "vue";
import DesktopLyricsContent from "./DesktopLyricsContent.vue";
import DesktopLyricsControls from "./DesktopLyricsControls.vue";

// 数据
const lyricsData = ref([]);
const currentIndex = ref(0);
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
const fontSize = ref(36);
const alignment = ref("center");
const scrollPosition = ref("center");
const enableHoverPause = ref(true);
const enableClickJump = ref(true);
const windowOpacity = ref(0.9);
const hoverOpacity = ref(0.95);

// 控制栏显示
const showControls = ref(false);
const controlsTimer = ref(null);

// 窗口样式（锁定时背景透明，仅显示歌词）
const windowStyle = computed(() => ({
  opacity: showControls.value ? hoverOpacity.value : windowOpacity.value,
  transition: "opacity 0.3s ease",
  background: isLocked.value ? "transparent" : undefined,
}));

// Refs
const lyricsArea = ref(null);

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
const handleDragStart = (e) => {
  if (isLocked.value || isResizing) return;
  
  // 只在歌词区域空白处可拖拽
  if (e.target.classList.contains("lyric-line")) return;
  
  isDragging = true;
  // 使用屏幕坐标，避免瞬移
  dragStartX = e.screenX;
  dragStartY = e.screenY;
  lastMoveScreenX = e.screenX;
  lastMoveScreenY = e.screenY;
  
  document.addEventListener("mousemove", handleDragMove);
  document.addEventListener("mouseup", handleDragEnd);
  
  // 改变鼠标样式
  document.body.style.cursor = "move";
};

// 处理拖拽移动
const handleDragMove = (e) => {
  if (!isDragging) return;
  
  // 基于上一次mousemove的增量，避免累计过冲
  const deltaX = e.screenX - lastMoveScreenX;
  const deltaY = e.screenY - lastMoveScreenY;
  lastMoveScreenX = e.screenX;
  lastMoveScreenY = e.screenY;
  
  // 发送窗口移动消息到主进程
  if (typeof window.electron !== "undefined") {
    window.electron.ipcRenderer.send("desktop-lyrics-window-move", {
      deltaX,
      deltaY,
    });
  }
};

// 处理拖拽结束
const handleDragEnd = () => {
  isDragging = false;
  document.removeEventListener("mousemove", handleDragMove);
  document.removeEventListener("mouseup", handleDragEnd);
  document.body.style.cursor = "default";
};

// 处理大小调整开始
const handleResizeStart = (e, direction) => {
  if (isLocked.value) return;
  
  e.stopPropagation();
  isResizing = true;
  resizeDirection = direction;
  resizeStartY = e.screenY;
  
  // 获取当前窗口高度
  if (typeof window.electron !== "undefined") {
    window.electron.ipcRenderer.invoke("desktop-lyrics-get-state").then((state) => {
      if (state) {
        resizeStartHeight = state.bounds.height;
      }
    });
  }
  
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
  
  // 限制最小高度
  newHeight = Math.max(newHeight, 100);
  
  // 发送窗口大小调整消息到主进程
  if (typeof window.electron !== "undefined") {
    window.electron.ipcRenderer.send("desktop-lyrics-window-resize", {
      height: newHeight,
      direction: resizeDirection,
    });
  }
};

// 处理大小调整结束
const handleResizeEnd = () => {
  isResizing = false;
  resizeDirection = "";
  document.removeEventListener("mousemove", handleResizeMove);
  document.removeEventListener("mouseup", handleResizeEnd);
  document.body.style.cursor = "default";
};

// 切换锁定状态
const toggleLock = () => {
  isLocked.value = !isLocked.value;
  
  // 发送锁定状态变化到主进程
  if (typeof window.electron !== "undefined") {
    window.electron.ipcRenderer.send("desktop-lyrics-set-locked", isLocked.value);
  }
  // 锁定后强制隐藏控制栏
  if (isLocked.value) {
    showControls.value = false;
  }
};

// 关闭窗口
const handleClose = () => {
  if (typeof window.electron !== "undefined") {
    window.electron.ipcRenderer.send("desktop-lyrics-hide");
  }
};

// 控制栏鼠标移入
const handleControlBarEnter = () => {
  if (controlsTimer.value) {
    clearTimeout(controlsTimer.value);
    controlsTimer.value = null;
  }
};

// 控制栏鼠标移出
const handleControlBarLeave = () => {
  hideControlsDelayed();
};

// 歌词区域鼠标移入
const handleLyricsEnter = () => {
  // 锁定状态下不显示控制栏，只有解锁状态下才显示
  if (!isLocked.value) {
    showControls.value = true;
    
    if (controlsTimer.value) {
      clearTimeout(controlsTimer.value);
      controlsTimer.value = null;
    }
  }
};

// 歌词区域鼠标移出
const handleLyricsLeave = () => {
  hideControlsDelayed();
};

// 歌词内容鼠标移入
const handleContentMouseEnter = () => {
  // 透明度交互（阶段三实现）
};

// 歌词内容鼠标移出
const handleContentMouseLeave = () => {
  // 透明度交互（阶段三实现）
};

// 延迟隐藏控制栏
const hideControlsDelayed = () => {
  if (controlsTimer.value) {
    clearTimeout(controlsTimer.value);
  }
  
  controlsTimer.value = setTimeout(() => {
    showControls.value = false;
  }, 2000);
};

// 点击歌词跳转
const handleLyricClick = (time) => {
  if (typeof window.electron !== "undefined") {
    window.electron.ipcRenderer.send("desktop-lyrics-control", {
      action: "seek",
      value: time,
    });
  }
};

// 监听主进程发来的数据更新
const setupIpcListeners = () => {
  if (typeof window.electron !== "undefined") {
    console.log("设置桌面歌词窗口IPC监听器");
    
    // 播放状态更新
    window.electron.ipcRenderer.on("play-state-updated", (_, data) => {
      console.log("桌面歌词收到播放状态更新:", data);
      currentIndex.value = data.lyricIndex || 0;
      isPlaying.value = data.isPlaying || false;
    });

    // 歌词数据更新
    window.electron.ipcRenderer.on("lyric-data-updated", (_, data) => {
      console.log("桌面歌词收到歌词数据更新:", {
        lrcLength: data.lrc?.length || 0,
        hasYrc: data.hasYrc,
        hasLrcTran: data.hasLrcTran,
        hasLrcRoma: data.hasLrcRoma,
        firstLyric: data.lrc?.[0]?.content || "无歌词"
      });
      lyricsData.value = data.lrc || [];
      hasYrc.value = data.hasYrc || false;
      hasLrcTran.value = data.hasLrcTran || false;
      hasLrcRoma.value = data.hasLrcRoma || false;
      
      // 歌词数据更新后，延迟一点触发滚动到当前索引
      setTimeout(() => {
        console.log("歌词数据更新后，触发滚动到当前索引:", currentIndex.value);
        // 这里会通过props传递给DesktopLyricsContent组件，触发滚动
      }, 100);
    });

    // 歌曲信息更新
    window.electron.ipcRenderer.on("song-info-updated", (_, data) => {
      console.log("桌面歌词收到歌曲信息更新:", data);
      currentSong.value = data;
    });

    // 设置更新
    window.electron.ipcRenderer.on("settings-updated", (_, settings) => {
      console.log("桌面歌词收到设置更新:", settings);
      if (settings.desktopLyricsShowTitle !== undefined) {
        showSongInfo.value = settings.desktopLyricsShowTitle;
      }
      if (settings.desktopLyricsShowArtist !== undefined) {
        showArtist.value = settings.desktopLyricsShowArtist;
      }
      if (settings.desktopLyricsFontSize !== undefined) {
        fontSize.value = settings.desktopLyricsFontSize;
      }
      if (settings.desktopLyricsAlignment !== undefined) {
        alignment.value = settings.desktopLyricsAlignment;
      }
      if (settings.desktopLyricsScrollPosition !== undefined) {
        console.log("更新滚动位置设置:", settings.desktopLyricsScrollPosition);
        // 强制设置为居中，忽略存储中的错误值
        console.log("强制设置滚动位置为居中，忽略存储值:", settings.desktopLyricsScrollPosition);
        scrollPosition.value = "center";
      }
      if (settings.desktopLyricsHoverPause !== undefined) {
        enableHoverPause.value = settings.desktopLyricsHoverPause;
      }
      if (settings.desktopLyricsClickJump !== undefined) {
        enableClickJump.value = settings.desktopLyricsClickJump;
      }
      if (settings.desktopLyricsOpacity !== undefined) {
        windowOpacity.value = settings.desktopLyricsOpacity;
      }
      if (settings.desktopLyricsHoverOpacity !== undefined) {
        hoverOpacity.value = settings.desktopLyricsHoverOpacity;
      }
      if (settings.showTransl !== undefined) {
        showTransl.value = settings.showTransl;
      }
      if (settings.showRoma !== undefined) {
        showRoma.value = settings.showRoma;
      }
      if (settings.showYrc !== undefined) {
        showYrc.value = settings.showYrc;
      }
    });

    // 锁定状态变化
    window.electron.ipcRenderer.on("desktop-lyrics-lock-changed", (_, locked) => {
      console.log("桌面歌词锁定状态已更新:", locked);
      isLocked.value = locked;
    });
  }
};

onMounted(() => {
  console.log("桌面歌词窗口组件已挂载");
  
  // 设置IPC监听器
  setupIpcListeners();
  
  // 初始化时先显示控制栏，让用户能看到操作选项
  showControls.value = true;
  console.log("控制栏显示状态:", showControls.value);
  
  // 主动请求设置同步，确保字体大小等设置正确
  if (typeof window.electron !== "undefined") {
    window.electron.ipcRenderer.send("desktop-lyrics-sync-settings");
    console.log("已请求设置同步");
    
    // 主动请求歌曲信息同步
    window.electron.ipcRenderer.send("desktop-lyrics-sync-song-info");
    console.log("已请求歌曲信息同步");
  }
  
  // 延迟后再自动隐藏
  setTimeout(() => {
    hideControlsDelayed();
  }, 5000);
  
  // 打印歌词数据，便于调试
  console.log("当前歌词数据:", {
    歌词条数: lyricsData.value.length,
    当前索引: currentIndex.value,
    当前歌曲: currentSong.value,
    播放状态: typeof window.electron !== "undefined" ? "已连接" : "未连接",
    滚动位置设置: scrollPosition.value
  });
  
  // 检查DOM元素是否正确渲染
  setTimeout(() => {
    const controlBar = document.querySelector('.control-bar');
    const controls = document.querySelector('.desktop-lyrics-controls');
    const lyricsArea = document.querySelector('.lyrics-area');
    const windowElement = document.querySelector('.desktop-lyrics-window');
    
    console.log("桌面歌词窗口DOM元素检查:", {
      windowElement: windowElement ? "存在" : "不存在",
      controlBar: controlBar ? "存在" : "不存在",
      controls: controls ? "存在" : "不存在",
      lyricsArea: lyricsArea ? "存在" : "不存在",
      showControls: showControls.value,
      controlBarVisible: controlBar ? controlBar.style.display : "N/A",
      controlsVisible: controls ? controls.style.display : "N/A"
    });
    
    // 如果控制栏不存在，强制显示调试信息
    if (!controlBar || !controls) {
      console.error("控制栏DOM元素未找到！");
      const debugDiv = document.createElement('div');
      debugDiv.innerHTML = `
        <div style="color: red; font-size: 16px; font-weight: bold; margin-bottom: 10px;">
          ⚠️ 控制栏未正确渲染
        </div>
        <div style="color: white; font-size: 12px; margin-bottom: 5px;">
          窗口元素: ${windowElement ? "✓" : "✗"} | 控制栏: ${controlBar ? "✓" : "✗"} | 控制组件: ${controls ? "✓" : "✗"}
        </div>
        <div style="color: white; font-size: 12px;">
          歌词区域: ${lyricsArea ? "✓" : "✗"} | 显示控制: ${showControls.value}
        </div>
      `;
      debugDiv.style.position = 'absolute';
      debugDiv.style.top = '100px';
      debugDiv.style.left = '0';
      debugDiv.style.right = '0';
      debugDiv.style.background = 'rgba(255,165,0,0.8)';
      debugDiv.style.padding = '15px';
      debugDiv.style.textAlign = 'center';
      debugDiv.style.zIndex = '9999';
      document.body.appendChild(debugDiv);
    } else {
      console.log("✅ 控制栏DOM元素已正确渲染");
    }
  }, 1000);
});

onUnmounted(() => {
  // 清理定时器
  if (controlsTimer.value) {
    clearTimeout(controlsTimer.value);
  }
  
  // 清理事件监听
  document.removeEventListener("mousemove", handleDragMove);
  document.removeEventListener("mouseup", handleDragEnd);
  document.removeEventListener("mousemove", handleResizeMove);
  document.removeEventListener("mouseup", handleResizeEnd);
});
</script>

<style lang="scss" scoped>
.desktop-lyrics-window {
  width: 100vw;
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: rgba(0, 0, 0, 0.9); /* 增加不透明度 */
  backdrop-filter: blur(15px);
  -webkit-backdrop-filter: blur(15px);
  box-shadow: 0 0 20px rgba(0, 0, 0, 0.5); /* 添加阴影增强可见度 */
  position: relative;
  overflow: hidden;
  border: 2px solid rgba(255, 255, 255, 0.3); /* 添加边框，使窗口更明显 */

  // 控制栏
  .control-bar {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    z-index: 100;
    padding: 8px;
    background: linear-gradient(
      to bottom,
      rgba(0, 0, 0, 0.5),
      transparent
    );
  }

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
      content: "";
      position: absolute;
      left: 50%;
      transform: translateX(-50%);
      width: 40px;
      height: 3px;
      background: rgba(255, 255, 255, 0.3);
      border-radius: 2px;
      transition: background 0.2s;
    }
    
    &:hover::before {
      background: rgba(255, 255, 255, 0.6);
    }
    
    &.resize-handle-top {
      top: 0;
      
      &::before {
        top: 2px;
      }
    }
    
    &.resize-handle-bottom {
      bottom: 0;
      
      &::before {
        bottom: 2px;
      }
    }
  }

  // 锁定状态
  &.locked {
    .lyrics-area {
      cursor: default !important;
    }
    
    .resize-handle {
      display: none;
    }
    
    .control-bar {
      // 锁定状态下完全隐藏控制栏
      display: none !important;
    }
    
    /* 锁定时只显示歌词，移除背景、边框、阴影与控制栏 */
    background: transparent !important;
    backdrop-filter: none !important;
    -webkit-backdrop-filter: none !important;
    border: none !important;
    box-shadow: none !important;
  }
}
</style>