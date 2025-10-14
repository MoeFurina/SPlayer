<!-- 桌面歌词控制栏 -->
<template>
  <div class="desktop-lyrics-controls">
    <!-- 播放控制组 -->
    <div class="control-group play-controls">
      <button
        class="control-btn"
        @click="handlePrev"
        title="上一首"
      >
        ⏮
      </button>
      
      <button
        class="control-btn play-btn"
        @click="handlePlayPause"
        :title="isPlaying ? '暂停' : '播放'"
      >
        {{ isPlaying ? '⏸' : '▶' }}
      </button>
      
      <button
        class="control-btn"
        @click="handleNext"
        title="下一首"
      >
        ⏭
      </button>
    </div>

    <!-- 字体控制组 -->
    <div class="control-group font-controls">
      <button
        class="control-btn"
        @click="handleFontSizeChange(-2)"
        title="减小字体"
      >
        A-
      </button>
      
      <span class="font-size-display">{{ fontSize }}</span>
      
      <button
        class="control-btn"
        @click="handleFontSizeChange(2)"
        title="增大字体"
      >
        A+
      </button>
    </div>

    <!-- 功能按钮组 -->
    <div class="control-group function-controls">
      <!-- 锁定按钮 -->
      <button
        class="control-btn"
        :class="{ 'locked': isLocked }"
        @click="emit('toggle-lock')"
        :title="isLocked ? '解锁' : '锁定'"
      >
        {{ isLocked ? '🔒' : '🔓' }}
      </button>
      
      <!-- 关闭按钮 -->
      <button
        class="control-btn close-btn"
        @click="emit('close')"
        title="关闭"
      >
        ✕
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from "vue";

onMounted(() => {
  console.log("DesktopLyricsControls组件已挂载");
  
  // 设置IPC监听器
  setupIpcListeners();
  
  // 检查组件是否正确渲染
  setTimeout(() => {
    const controlsElement = document.querySelector('.desktop-lyrics-controls');
    const buttons = document.querySelectorAll('.control-btn');
    console.log("DesktopLyricsControls渲染检查:", {
      controlsElement: controlsElement ? "存在" : "不存在",
      buttonsCount: buttons.length,
      props: {
        isLocked: props.isLocked,
        fontSize: props.fontSize
      }
    });
    
    if (!controlsElement || buttons.length === 0) {
      console.error("DesktopLyricsControls组件未正确渲染！");
    } else {
      console.log("✅ DesktopLyricsControls组件已正确渲染");
    }
  }, 500);
});

// Props
const props = defineProps({
  isLocked: {
    type: Boolean,
    default: false,
  },
  fontSize: {
    type: Number,
    default: 36,
  },
});

// Emits
const emit = defineEmits(["toggle-lock", "close"]);

// 播放状态（从主进程同步）
const isPlaying = ref(false);

// 播放控制
const handlePlayPause = () => {
  sendControl("playPause");
  // 不进行乐观更新，等待主窗口推送实际状态
  console.log("发送播放控制指令，等待状态同步");
};

const handlePrev = () => {
  sendControl("prev");
};

const handleNext = () => {
  sendControl("next");
};

// 字体大小调节
const handleFontSizeChange = (delta) => {
  const newSize = props.fontSize + delta;
  if (newSize >= 20 && newSize <= 72) {
    sendControl("fontSize", newSize);
  }
};

// 发送控制指令
const sendControl = (action, value) => {
  if (typeof window.electron !== "undefined") {
    window.electron.ipcRenderer.send("desktop-lyrics-control", {
      action,
      value,
    });
  }
};

// 监听播放状态更新
const setupIpcListeners = () => {
  if (typeof window.electron !== "undefined") {
    console.log("设置桌面歌词控制组件IPC监听器");
    
    window.electron.ipcRenderer.on("play-state-updated", (_, data) => {
      console.log("桌面歌词控制组件收到播放状态更新:", data);
      isPlaying.value = data.isPlaying;
    });
    
    // 监听桌面歌词显示事件，立即同步播放状态
    window.electron.ipcRenderer.on("desktop-lyrics-shown", () => {
      console.log("桌面歌词窗口显示，请求同步播放状态");
      // 请求主窗口同步当前播放状态
      window.electron.ipcRenderer.send("desktop-lyrics-sync-play-state");
    });
  }
};
</script>

<style lang="scss" scoped>
.desktop-lyrics-controls {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 12px;
  background: rgba(0, 0, 0, 0.7);
  border-radius: 8px;
  backdrop-filter: blur(10px);

  .control-group {
    display: flex;
    align-items: center;
    gap: 8px;

    .control-btn {
      background: rgba(255, 255, 255, 0.1);
      border: 1px solid rgba(255, 255, 255, 0.2);
      color: rgba(255, 255, 255, 0.9);
      padding: 6px 10px;
      border-radius: 6px;
      cursor: pointer;
      font-size: 14px;
      transition: all 0.2s ease;
      min-width: 32px;
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: center;

      &:hover {
        background: rgba(255, 255, 255, 0.2);
        color: #fff;
        transform: scale(1.05);
        border-color: rgba(255, 255, 255, 0.4);
      }

      &:active {
        transform: scale(0.95);
        background: rgba(255, 255, 255, 0.3);
      }

      &.play-btn {
        background: rgba(24, 160, 88, 0.3);
        border-color: rgba(24, 160, 88, 0.5);
        
        &:hover {
          background: rgba(24, 160, 88, 0.5);
          border-color: rgba(24, 160, 88, 0.7);
        }
      }

      &.locked {
        background: rgba(255, 193, 7, 0.3);
        border-color: rgba(255, 193, 7, 0.5);
        
        &:hover {
          background: rgba(255, 193, 7, 0.5);
          border-color: rgba(255, 193, 7, 0.7);
        }
      }

      &.close-btn {
        background: rgba(220, 53, 69, 0.3);
        border-color: rgba(220, 53, 69, 0.5);
        
        &:hover {
          background: rgba(220, 53, 69, 0.5);
          border-color: rgba(220, 53, 69, 0.7);
        }
      }
    }

    .font-size-display {
      font-size: 14px;
      color: rgba(255, 255, 255, 0.8);
      min-width: 30px;
      text-align: center;
      font-weight: 500;
    }
  }

  .play-controls {
    flex: 1;
    justify-content: center;
  }

  .font-controls {
    flex: 0 0 auto;
  }

  .function-controls {
    flex: 0 0 auto;
  }
}
/* 锁定后保留一个小的解锁浮点按钮 */
.unlock-fab {
  position: absolute;
  top: 8px;
  right: 8px;
  z-index: 110;
}
</style>