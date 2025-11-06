<!-- 桌面歌词控制栏 -->
<template>
  <div
    class="desktop-lyrics-controls"
    :style="{ background: `rgba(0, 0, 0, ${controlBarOpacity})` }"
    @mousedown="handleDragAreaMouseDown"
  >
    <!-- 自定义提示框 -->
    <div
      v-if="tooltip.show"
      class="custom-tooltip"
      :style="tooltip.style"
    >
      {{ tooltip.text }}
    </div>

    <!-- 播放控制组 -->
    <div class="control-group play-controls">
      <div
        class="control-btn"
        @click="handlePrevClick"
        @mouseenter="showTooltip('上一曲', $event)"
        @mouseleave="hideTooltip"
      >
        <SvgIcon icon="skip-previous-desktop" />
      </div>
      
      <div
        class="control-btn play-btn"
        @click="handlePlayPauseClick"
        @mouseenter="showTooltip(isPlaying ? '暂停' : '播放', $event)"
        @mouseleave="hideTooltip"
      >
        <SvgIcon :icon="isPlaying ? 'pause-desktop' : 'play-desktop'" />
      </div>
      
      <div
        class="control-btn"
        @click="handleNextClick"
        @mouseenter="showTooltip('下一曲', $event)"
        @mouseleave="hideTooltip"
      >
        <SvgIcon icon="skip-next-desktop" />
      </div>
    </div>

    <!-- 字体控制组 -->
    <div class="control-group font-controls">
      <div
        class="control-btn"
        @click="handleFontSizeDecreaseClick"
        @contextmenu.prevent="handleTitleFontSizeDecreaseClick"
        @mouseenter="handleFontSizeButtonEnter('decrease', $event)"
        @mouseleave="handleFontSizeButtonLeave"
        @wheel.prevent="handleFontSizeWheel('tranFontSize', $event)"
      >
        <SvgIcon icon="font-decrease" />
      </div>


      <div
        class="control-btn"
        @click="handleFontSizeIncreaseClick"
        @contextmenu.prevent="handleTitleFontSizeIncreaseClick"
        @mouseenter="handleFontSizeButtonEnter('increase', $event)"
        @mouseleave="handleFontSizeButtonLeave"
        @wheel.prevent="handleFontSizeWheel('romaFontSize', $event)"
      >
        <SvgIcon icon="font-increase" />
      </div>
    </div>

    <!-- 间距控制组 -->
    <div class="control-group spacing-controls">
      <!-- 行间距调节 -->
      <div
        class="control-btn spacing-btn"
        @mouseenter="handleSpacingButtonEnter('lineSpacing', $event)"
        @mouseleave="handleSpacingButtonLeave"
        @wheel.prevent="handleSpacingWheel('lineSpacing', $event)"
      >
        <SvgIcon icon="line-spacing" />
      </div>

      <!-- 字间距调节 -->
      <div
        class="control-btn spacing-btn"
        @mouseenter="handleSpacingButtonEnter('letterSpacing', $event)"
        @mouseleave="handleSpacingButtonLeave"
        @wheel.prevent="handleSpacingWheel('letterSpacing', $event)"
      >
        <SvgIcon icon="text-spacing" />
      </div>
    </div>

    <!-- 歌词功能组 -->
    <div class="control-group lyrics-controls">
      <!-- 逐字歌词开关 -->
      <div
        class="control-btn"
        :class="{ 'active': showYrc }"
        @click="handleToggleYrcClick"
        @mouseenter="showTooltip('逐字歌词', $event)"
        @mouseleave="hideTooltip"
      >
        <SvgIcon :icon="showYrc ? 'lyric-2' : 'lyric-1'" />
      </div>
    </div>

    <!-- 透明度控制组 -->
    <div class="control-group opacity-controls">
      <!-- 降低基础透明度 -->
      <div
        class="control-btn opacity-btn"
        @click="handleOpacityDecreaseClick"
        @contextmenu.prevent="handleWindowOpacityDecreaseClick"
        @mouseenter="showTooltip('降低透明度 (右击调整歌词框透明度)', $event)"
        @mouseleave="hideTooltip"
      >
        <SvgIcon icon="transparency-decrease" />
      </div>

      <!-- 提高基础透明度 -->
      <div
        class="control-btn opacity-btn"
        @click="handleOpacityIncreaseClick"
        @contextmenu.prevent="handleWindowOpacityIncreaseClick"
        @mouseenter="showTooltip('提高透明度 (右击调整歌词框透明度)', $event)"
        @mouseleave="hideTooltip"
      >
        <SvgIcon icon="transparency-increase" />
      </div>
    </div>

    <!-- 功能按钮组 -->
    <div class="control-group function-controls">
      <!-- 锁定按钮 -->
      <div
        class="control-btn lock-btn"
        :class="{ 'locked': isLocked }"
        @click="handleLockClick"
        @contextmenu.prevent="handleLockRightClick($event)"
        @mouseenter="showTooltip(getLockButtonTitle(), $event)"
        @mouseleave="hideTooltip"
      >
        <SvgIcon :icon="isLocked ? 'unlock-desktop' : 'lock-desktop'" />
      </div>

      <!-- 关闭按钮 -->
      <div
        class="control-btn close-btn"
        @click="handleCloseClick"
        @mouseenter="showTooltip('关闭', $event)"
        @mouseleave="hideTooltip"
      >
        <SvgIcon icon="window-close-desktop" />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from "vue";
import SvgIcon from "@/components/Global/SvgIcon.vue";

// 发送 IPC 消息
const sendIpc = (channel, ...args) => {
  if (typeof window.electron !== "undefined") {
    window.electron.ipcRenderer.send(channel, ...args);
  }
};

// 数值范围限制
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

// 字号调节范围和步进配置
const FONT_SIZE_CONFIG = {
  min: 5,
  max: 55,
  stepThreshold: 25,
  smallStep: 0.5,
  largeStep: 1
};

// 字号类型配置
const fontSizeConfig = {
  tranFontSize: {
    propName: 'tranFontSize',
    label: '翻译字号',
    buttonLabel: '减小字体'
  },
  romaFontSize: {
    propName: 'romaFontSize',
    label: '罗马音字号',
    buttonLabel: '增大字体'
  }
};

// 生成字号调节提示文本
const getFontSizeTooltip = (type, value = null) => {
  const config = fontSizeConfig[type];
  const valueText = value !== null ? `: ${value}px` : '';
  return `${config.buttonLabel} (右击调整作品信息字号;\n滚轮调整${config.label}${valueText})`;
};

// 计算字号调节步进值
const calculateFontSizeStep = (currentValue) => {
  return currentValue < FONT_SIZE_CONFIG.stepThreshold
    ? FONT_SIZE_CONFIG.smallStep
    : FONT_SIZE_CONFIG.largeStep;
};

onMounted(() => {
  setupIpcListeners();
});

onUnmounted(() => {
  clearAllTimers();
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
  titleFontSize: {
    type: Number,
    default: 16,
  },
  tranFontSize: {
    type: Number,
    default: 10,
  },
  romaFontSize: {
    type: Number,
    default: 8,
  },
  showYrc: {
    type: Boolean,
    default: false,
  },
  windowOpacity: {
    type: Number,
    default: 0.9,
  },
  windowBackgroundOpacity: {
    type: Number,
    default: 0.3,
  },
  controlBarOpacity: {
    type: Number,
    default: 0.9,
  },
  autoLockEnabled: {
    type: Boolean,
    default: true,
  },
  lineSpacing: {
    type: Number,
    default: 1.2,
  },
  letterSpacing: {
    type: Number,
    default: 0,
  },
});

// Emits
const emit = defineEmits(["toggle-lock", "close", "toggle-yrc", "opacity-change", "title-font-size-change", "spacing-change", "font-size-change"]);

// 播放状态（从主进程同步）
const isPlaying = ref(false);

// 自定义提示相关
const tooltip = ref({
  show: false,
  text: '',
  style: {}
});

const tooltipTimer = ref(null);
const delayedHideTimer = ref(null); // 用于右击后延迟隐藏的定时器
const tooltipDelay = 500; // 0.5秒延迟

// 播放控制
const handlePlayPauseClick = () => {
  hideTooltip();
  sendControl("playPause");
};

const handlePrevClick = () => {
  hideTooltip();
  sendControl("prev");
};

const handleNextClick = () => {
  hideTooltip();
  sendControl("next");
};

// 辅助函数：字体大小调节
const adjustFontSize = (currentSize, delta, min, max, callback) => {
  hideTooltip();
  const newSize = clamp(currentSize + delta, min, max);
  if (newSize !== currentSize) {
    callback(newSize);
  }
};

// 字体大小调节
const handleFontSizeDecreaseClick = () => {
  adjustFontSize(props.fontSize, -1, 10, 72, (size) => sendControl("fontSize", size));
};

const handleFontSizeIncreaseClick = () => {
  adjustFontSize(props.fontSize, 1, 10, 72, (size) => sendControl("fontSize", size));
};

// 作品信息字号调节
const handleTitleFontSizeDecreaseClick = () => {
  adjustFontSize(props.titleFontSize, -1, 8, 32, (size) => emit("title-font-size-change", size));
};

const handleTitleFontSizeIncreaseClick = () => {
  adjustFontSize(props.titleFontSize, 1, 8, 32, (size) => emit("title-font-size-change", size));
};

// 逐字歌词开关
const handleToggleYrcClick = () => {
  hideTooltip();
  sendControl("toggleYrc");
};

// 透明度调节
const adjustOpacity = (currentValue, delta, min, max, controlKey) => {
  hideTooltip();
  const newValue = clamp(currentValue + delta, min, max);
  sendControl(controlKey, newValue);
};

const handleOpacityDecreaseClick = () => {
  adjustOpacity(props.windowOpacity, -0.1, 0.1, 1, 'windowOpacity');
};

const handleOpacityIncreaseClick = () => {
  adjustOpacity(props.windowOpacity, 0.1, 0.1, 1, 'windowOpacity');
};

// 桌面歌词框透明度调节（右击）
const handleWindowOpacityDecreaseClick = () => {
  adjustOpacity(props.windowBackgroundOpacity, -0.05, 0, 1, 'windowBackgroundOpacity');
};

const handleWindowOpacityIncreaseClick = () => {
  adjustOpacity(props.windowBackgroundOpacity, 0.05, 0, 1, 'windowBackgroundOpacity');
};

// 字号调节相关状态
const currentFontSizeType = ref(null);

// 字号按钮悬停进入
const handleFontSizeButtonEnter = (type, event) => {
  currentFontSizeType.value = type;
  const fontSizeType = type === 'decrease' ? 'tranFontSize' : 'romaFontSize';
  showTooltip(getFontSizeTooltip(fontSizeType), event);
};

// 字号按钮悬停离开
const handleFontSizeButtonLeave = () => {
  currentFontSizeType.value = null;
  hideTooltip();
};

// 字号滚轮调节
const handleFontSizeWheel = (type, event) => {
  if (!currentFontSizeType.value) return;

  event.preventDefault();
  const delta = event.deltaY > 0 ? -1 : 1;

  // 获取配置
  const config = fontSizeConfig[type];
  const currentValue = props[config.propName];

  // 计算新值
  const step = calculateFontSizeStep(currentValue);
  const newValue = clamp(
    currentValue + (delta * step),
    FONT_SIZE_CONFIG.min,
    FONT_SIZE_CONFIG.max
  );

  // 发送事件
  emit('font-size-change', type, newValue);

  // 更新提示文本
  tooltip.value.text = getFontSizeTooltip(type, newValue);
};

// 间距调节相关状态
const currentSpacingType = ref(null);

// 间距按钮悬停进入
const handleSpacingButtonEnter = (type, event) => {
  currentSpacingType.value = type;
  let tooltipText;
  if (type === 'lineSpacing') {
    const displayText = props.lineSpacing < 0
      ? `重叠${Math.abs(props.lineSpacing)}px`
      : `${props.lineSpacing}px`;
    tooltipText = `行间距: ${displayText} (滚轮调节)`;
  } else {
    tooltipText = `字间距: ${props.letterSpacing}px (滚轮调节)`;
  }
  showTooltip(tooltipText, event);
};

// 间距按钮悬停离开
const handleSpacingButtonLeave = () => {
  currentSpacingType.value = null;
  hideTooltip();
};

// 计算自适应步进
const getAdaptiveStep = (value, thresholds) => {
  const absValue = Math.abs(value);
  for (let i = 0; i < thresholds.length; i++) {
    if (absValue < thresholds[i].threshold) {
      return thresholds[i].step;
    }
  }
  return thresholds[thresholds.length - 1].step;
};

// 间距滚轮调节
const handleSpacingWheel = (type, event) => {
  if (currentSpacingType.value !== type) return;

  event.preventDefault();
  const delta = event.deltaY > 0 ? -1 : 1;

  if (type === 'lineSpacing') {
    // 行间距范围-20~200px，使用自适应步进
    const step = getAdaptiveStep(props.lineSpacing, [
      { threshold: 20, step: 1 },
      { threshold: 60, step: 2 },
      { threshold: Infinity, step: 5 }
    ]);

    const newValue = clamp(props.lineSpacing + (delta * step), -20, 200);
    emit('spacing-change', 'lineSpacing', newValue);

    const displayText = newValue < 0 ? `重叠${Math.abs(newValue)}px` : `${newValue}px`;
    tooltip.value.text = `行间距: ${displayText} (滚轮调节)`;
  } else if (type === 'letterSpacing') {
    // 字间距范围-10~80px，使用自适应步进
    const step = getAdaptiveStep(props.letterSpacing, [
      { threshold: 10, step: 0.5 },
      { threshold: 30, step: 1 },
      { threshold: Infinity, step: 2 }
    ]);

    const newValue = clamp(props.letterSpacing + (delta * step), -10, 80);
    emit('spacing-change', 'letterSpacing', newValue);

    tooltip.value.text = `字间距: ${newValue}px (滚轮调节)`;
  }
};

const handleLockClick = () => {
  hideTooltip();
  emit('toggle-lock');
};

const handleCloseClick = () => {
  hideTooltip();
  emit('close');
};

// 辅助函数：清理单个定时器
const clearTimer = (timer) => {
  if (timer.value) {
    clearTimeout(timer.value);
    timer.value = null;
  }
};

// 清理所有定时器
const clearAllTimers = () => {
  clearTimer(tooltipTimer);
  clearTimer(delayedHideTimer);
};

// 获取锁定按钮的标题文本
const getLockButtonTitle = () => {
  const lockText = props.isLocked ? '解锁' : '锁定';
  return `${lockText}(右击${props.autoLockEnabled ? '关闭' : '开启'}自动锁定)`;
};

// 显示延迟提示
const showTooltip = (text, event) => {
  clearAllTimers();
  
  tooltipTimer.value = setTimeout(() => {
    tooltip.value = {
      show: true,
      text: text,
      style: {
        left: `${event.clientX + 5}px`,
        top: `${event.clientY + 5}px`
      }
    };
  }, tooltipDelay);
};

// 隐藏提示
const hideTooltip = () => {
  clearAllTimers();
  tooltip.value.show = false;
};

// 锁定按钮右击处理
const handleLockRightClick = (event) => {
  clearAllTimers();
  sendControl("toggleAutoLock");

  // 预测新的自动锁定状态，并立即更新提示文本
  const predictedAutoLockState = !props.autoLockEnabled;
  const statusText = predictedAutoLockState ? "已开启自动锁定" : "已关闭自动锁定";

  // 立即显示更新后的提示
  tooltip.value = {
    show: true,
    text: statusText,
    style: {
      left: `${event.clientX + 5}px`,
      top: `${event.clientY + 5}px`
    }
  };

  // 设置2秒后延迟隐藏
  delayedHideTimer.value = setTimeout(() => {
    tooltip.value.show = false;
    delayedHideTimer.value = null;
  }, 2000);
};

// 发送控制指令
const sendControl = (action, value) => {
  sendIpc("desktop-lyrics-control", { action, value });
};

// 控制栏拖拽处理
const dragState = ref({ active: false, moved: false, lastX: 0, lastY: 0 });

const handleDragAreaMouseDown = (e) => {
  dragState.value = { active: true, moved: false, lastX: e.screenX, lastY: e.screenY };
  document.addEventListener("mousemove", handleDragMove);
  document.addEventListener("mouseup", handleDragEnd);
  document.addEventListener("click", preventClickAfterDrag, true);
};

const handleDragMove = (e) => {
  if (!dragState.value.active) return;
  dragState.value.moved = true;
  sendIpc("desktop-lyrics-window-move", {
    deltaX: e.screenX - dragState.value.lastX,
    deltaY: e.screenY - dragState.value.lastY
  });
  dragState.value.lastX = e.screenX;
  dragState.value.lastY = e.screenY;
};

const handleDragEnd = () => {
  dragState.value.active = false;
  document.removeEventListener("mousemove", handleDragMove);
  document.removeEventListener("mouseup", handleDragEnd);
  setTimeout(() => {
    document.removeEventListener("click", preventClickAfterDrag, true);
    dragState.value.moved = false;
  }, 0);
};

const preventClickAfterDrag = (e) => {
  if (dragState.value.moved) {
    e.stopPropagation();
    e.preventDefault();
  }
};

// 监听播放状态更新
const setupIpcListeners = () => {
  if (typeof window.electron !== "undefined") {
    window.electron.ipcRenderer.on("play-state-updated", (_, data) => {
      isPlaying.value = data.isPlaying;
    });

    window.electron.ipcRenderer.on("desktop-lyrics-shown", () => {
      sendIpc("desktop-lyrics-sync-play-state");
    });
  }
};
</script>

<style lang="scss" scoped>
  .desktop-lyrics-controls {
    // 统一控制所有图标大小
    --icon-size: 16px;
    --btn-padding: 8px;

  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 5px;
  padding: 1px 8px;
  border-radius: 0;
  border: none;
  width: 100%;
  position: relative;

  // 自定义提示框样式
  .custom-tooltip {
    position: fixed;
    background: #333;
    color: #fff;
    padding: 4px 8px;
    border-radius: 2px;
    font-size: 11px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    white-space: pre-line;
    z-index: 9999;
    pointer-events: none;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
    border: none;
    max-width: 250px;
    word-wrap: break-word;
    line-height: 1.4;
  }

  .control-group {
    display: flex;
    align-items: center;
    gap: 4px;

    .control-btn {
      // div元素,强制设置透明背景
      background: transparent !important;
      background-color: transparent !important;
      background-image: none !important;
      border: none !important;
      outline: none !important;
      box-shadow: none !important;
      color: rgba(255, 255, 255, 0.85);
      padding: var(--btn-padding);
      border-radius: 4px;
      cursor: pointer;
      transition: color 0.15s ease, transform 0.15s ease, background-color 0.15s ease;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      user-select: none;
      
      // 确保所有状态都是透明的
      &:not(:hover):not(:active) {
        background: transparent !important;
        background-color: transparent !important;
        background-image: none !important;
        box-shadow: none !important;
      }

      // SVG图标统一样式
      :deep(.svg-icon) {
        color: currentColor;
        transition: all 0.15s ease;
        display: inline-block;
        width: var(--icon-size);
        height: var(--icon-size);
      }


      &:hover {
        background-color: rgba(255, 255, 255, 0.15);
        color: #fff;
        transform: scale(1.05);
      }

      &:active {
        transform: scale(0.95);
        background-color: rgba(255, 255, 255, 0.2);
      }

      // 激活状态
      &.active {
        color: rgba(255, 255, 255, 0.95);
        
        &:hover {
          background-color: rgba(255, 255, 255, 0.2);
          color: #fff;
        }
      }
      
      // 锁定按钮特殊处理
      &.locked {
        background: transparent !important;
        background-color: transparent !important;
        background-image: none !important;
        box-shadow: none !important;
        border: none !important;
        outline: none !important;
        
        &:not(:hover):not(:active) {
          background: transparent !important;
          background-color: transparent !important;
          background-image: none !important;
          box-shadow: none !important;
        }
      }
    }

  }

  // 控制组布局（所有图标大小统一由.control-btn控制）
  .play-controls,
  .font-controls,
  .spacing-controls,
  .lyrics-controls,
  .opacity-controls,
  .function-controls {
    flex: 0 0 auto;
  }
}
</style>