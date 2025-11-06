<!-- 桌面歌词内容组件 - 复用Lyric.vue的渲染逻辑 -->
<template>
  <div
    :class="['desktop-lyrics-content', `align-${alignment}`, { 'locked': isLocked }]"
    @wheel="handleWheel"
  >
    <!-- 歌曲信息 -->
    <div 
      v-if="showSongInfo && currentSong.name && !isLocked" 
      ref="songInfoElement"
      class="song-info"
    >
      <div 
        class="song-name" 
        :style="{ fontSize: titleFontSize + 'px' }"
      >
        {{ currentSong.name }}
      </div>
      <div 
        v-if="showArtist" 
        class="song-artist"
        :style="{ fontSize: (titleFontSize - 4) + 'px' }"
      >
        {{ currentSong.artists }}
      </div>
    </div>

    <!-- 歌词滚动区域 -->
    <div ref="lyricsContainer" class="lyrics-container">
      <Transition name="fade" mode="out-in">
        <div
          v-if="lyricsData.length > 0"
          :key="lyricsData[0]?.content"
          class="lyrics-wrapper"
        >
          <div
            ref="lyricScroll"
            class="lyrics-scrollbar native"
            @mousemove="handleMouseMove"
            @mouseleave="handleContainerMouseLeave"
            @scroll="handleScroll"
          >
            <!-- 歌词行渲染：统一使用逐字格式（包括常规歌词和逐字歌词） -->
            <div
              v-for="(item, index) in mergedLyricsData"
              :id="'lrc' + index"
              :key="index"
              :class="{
                'lyric-line': true,
                'lyric-line-yrc': true,
                'lyric-line-yrc-english': item.isEnglish,
                'on': currentIndex === index,
                'clickable': enableClickJump,
                'manual-hover': hoveredLyricIndex === index && currentIndex !== index,
              }"
              :style="getYrcLineStyle(index)"
              @mousedown="handleLyricMouseDown"
              @click="handleLyricClick(item.time, index, $event)"
              @mouseenter="handleLyricLineEnter"
              @mouseleave="handleLyricLineLeave"
            >
              <!-- 歌词内容 -->
              <div
                :style="{ fontSize: fontSize + 'px' }"
                class="lyric-text lyric-text-yrc"
              >
                <div
                  v-for="(word, wordIndex) in item.content"
                  :key="wordIndex"
                  :class="{
                    'lyric-word': true,
                    'lyric-word-regular': item.isRegularLyric,
                    'word-long': word.duration >= 1.5,
                    'word-space': word.endsWithSpace,
                  }"
                >
                  <span class="word-base">{{ word.content }}</span>
                  <!-- 逐字动画层：仅真正的逐字歌词显示 -->
                  <span
                    v-if="!item.isRegularLyric"
                    class="word-filler"
                    :style="getYrcWordStyle(word, index)"
                  >
                    {{ word.content }}
                  </span>
                </div>
              </div>

              <!-- 歌词翻译 -->
              <span
                v-if="showTransl && hasLrcTran && item.tran"
                :style="{ fontSize: tranFontSize + 'px' }"
                class="lyric-tran"
              >
                {{ item.tran }}
              </span>

              <!-- 歌词音译 -->
              <span
                v-if="showRoma && hasLrcRoma && item.roma"
                :style="{ fontSize: romaFontSize + 'px' }"
                class="lyric-roma"
              >
                {{ item.roma }}
              </span>
            </div>
          </div>
        </div>
      </Transition>

  <!-- 无歌词提示 -->
  <div v-if="lyricsData.length === 0" class="no-lyrics">
    <span>{{ noLyricsText }}</span>
  </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from "vue";

// 组件属性定义
const props = defineProps({
  // 常规歌词数据
  lyricsData: {
    type: Array,
    default: () => [],
  },
  // 逐字歌词数据
  yrcData: {
    type: Array,
    default: () => [],
  },
  // 当前播放歌词索引
  currentIndex: {
    type: Number,
    default: 0,
  },
  // 当前播放进度（秒）
  currentSeek: {
    type: Number,
    default: 0,
  },
  // 播放状态
  isPlaying: {
    type: Boolean,
    default: false,
  },
  // 当前歌曲信息
  currentSong: {
    type: Object,
    default: () => ({}),
  },
  // 是否有逐字歌词
  hasYrc: {
    type: Boolean,
    default: false,
  },
  // 是否有歌词翻译
  hasLrcTran: {
    type: Boolean,
    default: false,
  },
  // 是否有歌词音译
  hasLrcRoma: {
    type: Boolean,
    default: false,
  },
  // 是否显示逐字歌词
  showYrc: {
    type: Boolean,
    default: false,
  },
  // 是否显示翻译
  showTransl: {
    type: Boolean,
    default: true,
  },
  // 是否显示音译
  showRoma: {
    type: Boolean,
    default: true,
  },
  // 是否显示歌曲信息
  showSongInfo: {
    type: Boolean,
    default: true,
  },
  // 是否显示歌手名
  showArtist: {
    type: Boolean,
    default: true,
  },
  // 是否锁定窗口
  isLocked: {
    type: Boolean,
    default: false,
  },
  // 歌词字体大小
  fontSize: {
    type: Number,
    default: 36,
  },
  // 标题字体大小
  titleFontSize: {
    type: Number,
    default: 16,
  },
  // 翻译字体大小
  tranFontSize: {
    type: Number,
    default: 10,
  },
  // 音译字体大小
  romaFontSize: {
    type: Number,
    default: 8,
  },
  // 行间距
  lineSpacing: {
    type: Number,
    default: 1.2,
  },
  // 字间距
  letterSpacing: {
    type: Number,
    default: 0,
  },
  // 对齐方式
  alignment: {
    type: String,
    default: "center",
  },
  // 滚动位置
  scrollPosition: {
    type: String,
    default: "center",
  },
  // 是否启用悬停暂停
  enableHoverPause: {
    type: Boolean,
    default: true,
  },
  // 是否启用点击跳转
  enableClickJump: {
    type: Boolean,
    default: true,
  },
});

// 事件定义
const emit = defineEmits(["lyric-click", "mouse-enter", "mouse-leave"]);

// 响应式引用
const lyricScroll = ref(null);
const lyricsContainer = ref(null);
const songInfoElement = ref(null);
const isMouseHover = ref(false);
const hoveredLyricIndex = ref(-1);
let resizeObserver = null;
const mouseState = { x: 0, y: 0, inWindow: false };
let hoverDetectTimer = null;
let hoverTimer = null;

// 无歌词提示文本
const noLyricsText = computed(() => {
  if (!props.currentSong.name) return "等待播放...";
  return "暂无歌词";
});

// 合并歌词数据源（优先使用逐字歌词）
const mergedLyricsData = computed(() =>
  (props.showYrc && props.hasYrc && props.yrcData.length > 0)
    ? props.yrcData
    : props.lyricsData
);


// 强制滚动到当前歌词（带重试机制）
const forceScrollToCurrent = (retryCount = 0) => {
  nextTick(() => {
    const container = lyricScroll.value;
    if (!container && retryCount < 4) {
      setTimeout(() => {
        forceScrollToCurrent(retryCount + 1);
      }, 80);
      return;
    }

    const dataLength = mergedLyricsData.value.length;
    if (props.currentIndex >= 0 && props.currentIndex < dataLength) {
      scrollToLyric(props.currentIndex);
    } else if (dataLength > 0) {
      scrollToLyric(0);
    }
  });
};

// 行间距配置（包含伪元素扩展量计算）
const lineSpacingConfig = computed(() => {
  const lineHeightOffset = props.fontSize * 0.18;
  const baseMargin = props.lineSpacing / 2 - lineHeightOffset;

  let expandAmount = 15;
  if (props.lineSpacing < 0) {
    expandAmount = Math.max(20, Math.abs(props.lineSpacing) + 15);
  } else if (props.lineSpacing > 20) {
    expandAmount = props.lineSpacing / 2 + 10;
  }
  expandAmount *= 1.16;

  return {
    marginTop: baseMargin,
    marginBottom: baseMargin,
    expandAmount,
  };
});

// 生成歌词行样式
const getYrcLineStyle = (index) => {
  const isActive = index === props.currentIndex;
  const { marginTop, marginBottom, expandAmount } = lineSpacingConfig.value;

  // 计算歌词透明度
  let opacity = 0.35; // 常规句
  if (isActive) {
    opacity = 1;
  } else if (index === props.currentIndex - 1 || index === props.currentIndex + 1) {
    opacity = 0.6; // 前后句
  }

  return {
    transform: `scale(${isActive ? 1 : 0.86})`,
    opacity: opacity,
    lineHeight: `${props.fontSize * 1.0}px`,
    letterSpacing: `${props.letterSpacing}px`,
    marginTop: `${marginTop}px`,
    marginBottom: `${marginBottom}px`,
    '--expand-top': `-${expandAmount}px`,
    '--expand-bottom': `-${expandAmount}px`,
    '--letter-spacing': `${props.letterSpacing}px`,
  };
};

// 创建逐字歌词动画基础样式
const createYrcWordBaseStyle = (maskPosition, duration = "0ms", delay = "0ms") => {
  const isZeroDuration = duration === "0ms";
  return {
    transitionDuration: `${duration}, ${isZeroDuration ? "0ms" : `${parseFloat(duration) * 0.8}ms`}, 0.35s`,
    transitionDelay: `${delay}, ${isZeroDuration ? "0ms" : `${parseFloat(delay) + parseFloat(duration) * 0.5}ms`}, 0ms`,
    WebkitMaskPositionX: maskPosition,
    letterSpacing: `${props.letterSpacing}px`,
  };
};

// 计算逐字歌词动画样式
const getYrcWordStyle = (wordData, lyricIndex) => {
  if (props.currentIndex !== lyricIndex) {
    return createYrcWordBaseStyle("100%");
  }

  const currentSeek = props.currentSeek;
  const { time, duration } = wordData;
  const endTime = time + duration;

  if (currentSeek >= endTime) {
    return createYrcWordBaseStyle("0%", "0s");
  }

  if (currentSeek >= time) {
    const progress = Math.min(1, (currentSeek - time) / duration);
    return createYrcWordBaseStyle(`${100 - progress * 100}%`, "0s");
  }

  const delay = (time - currentSeek) * 1000;
  return createYrcWordBaseStyle("100%", `${duration * 1000}ms`, `${delay}ms`);
};

// 滚动到指定歌词行
const scrollToLyric = (index) => {
  if (isMouseHover.value && props.enableHoverPause) {
    return;
  }

  if (index < 0 || index >= props.lyricsData.length) {
    return;
  }

  nextTick(() => {
    const el = document.getElementById("lrc" + index);
    if (!el) {
      return;
    }

    const container = lyricScroll.value;
    if (!container) {
      return;
    }

    const containerHeight = container.clientHeight;
    const elementTop = el.offsetTop;
    const elementHeight = el.clientHeight;
    const currentScrollTop = container.scrollTop;

    const elementTopInView = elementTop - currentScrollTop;
    const elementBottomInView = elementTopInView + elementHeight;

    if (props.scrollPosition === "center") {
      el.scrollIntoView({
        behavior: "smooth",
        block: "center"
      });
    } else {
      el.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
    }
  });
};

// 监听歌词变化并自动滚动
watch(
  () => [
    props.currentIndex,
    props.lyricsData,
    props.yrcData,
    props.showYrc,
    props.isPlaying
  ],
  ([currentIndex, lyricsData, yrcData, showYrc, isPlaying], [oldIndex, oldLyricsData, oldYrcData, oldShowYrc, oldIsPlaying]) => {
    if (currentIndex !== oldIndex) {
      forceScrollToCurrent();
      return;
    }

    const hasLyricsDataChanged = lyricsData !== oldLyricsData && lyricsData?.length > 0;
    const hasYrcDataChanged = yrcData !== oldYrcData && yrcData?.length > 0;
    const hasShowYrcChanged = showYrc !== oldShowYrc;
    const hasPlayingChanged = isPlaying !== oldIsPlaying && isPlaying;

    if (hasLyricsDataChanged || hasYrcDataChanged || hasShowYrcChanged || hasPlayingChanged) {
      nextTick(() => {
        forceScrollToCurrent();
      });
    }
  }
);

// 处理滚轮事件
const handleWheel = (e) => {
  // 滚轮滚动时保持悬停状态
};

// 清除悬停定时器
const clearHoverTimer = () => {
  if (hoverTimer) {
    clearTimeout(hoverTimer);
    hoverTimer = null;
  }
};

// 歌词行鼠标进入事件
const handleLyricLineEnter = () => {
  clearHoverTimer();
  isMouseHover.value = true;
  emit("mouse-enter");
};

// 歌词行鼠标离开事件
const handleLyricLineLeave = () => {
  clearHoverTimer();
  hoverTimer = setTimeout(() => {
    isMouseHover.value = false;
    emit("mouse-leave");
    forceScrollToCurrent();
  }, 100);
};

// 统一的悬停检测调度（防抖）
const scheduleHoverDetect = (delay = 50) => {
  if (hoverDetectTimer) clearTimeout(hoverDetectTimer);
  hoverDetectTimer = setTimeout(() => {
    updateHoveredLyric();
    hoverDetectTimer = null;
  }, delay);
};

// 鼠标移动时更新坐标并调度检测
const handleMouseMove = (e) => {
  mouseState.x = e.clientX;
  mouseState.y = e.clientY;
  mouseState.inWindow = true;
  scheduleHoverDetect(50);
};

// 滚动结束后调度检测
const handleScroll = () => {
  scheduleHoverDetect(100);
};

// 检测鼠标悬停的歌词行（包含伪元素扩展区域）
const updateHoveredLyric = () => {
  if (!mouseState.inWindow) {
    hoveredLyricIndex.value = -1;
    return;
  }

  const { expandAmount } = lineSpacingConfig.value;
  const { x: mouseX, y: mouseY } = mouseState;

  hoveredLyricIndex.value = mergedLyricsData.value.findIndex((_, i) => {
    const el = document.getElementById('lrc' + i);
    if (!el) return false;

    const rect = el.getBoundingClientRect();
    return mouseY >= rect.top - expandAmount &&
           mouseY <= rect.bottom + expandAmount &&
           mouseX >= rect.left &&
           mouseX <= rect.right;
  });
};

// 处理鼠标离开歌词容器
const handleContainerMouseLeave = () => {
  mouseState.inWindow = false;
  hoveredLyricIndex.value = -1;
};

// 检查元素是否为文字元素
const isTextElement = (element) => {
  const textClasses = ['lyric-text', 'lyric-tran', 'lyric-roma', 'word-base', 'word-filler', 'lyric-word', 'lyric-text-yrc'];
  return textClasses.some(cls => element.classList.contains(cls)) || element.tagName === 'SPAN';
};

// 处理歌词行鼠标按下事件（区分拖拽和点击）
const handleLyricMouseDown = (event) => {
  if (isTextElement(event.target)) {
    event.stopPropagation();
  }
};

// 处理歌词行点击事件（跳转播放进度）
const handleLyricClick = (time, index, event) => {
  if (!props.enableClickJump) return;

  if (isTextElement(event.target)) {
    emit("lyric-click", time);
    return;
  }

  const clickY = event.clientY;
  const container = lyricScroll.value;

  if (!container) {
    emit("lyric-click", time);
    return;
  }

  const lyricElements = [];
  const dataArray = mergedLyricsData.value;

  for (let i = 0; i < dataArray.length; i++) {
    const el = document.getElementById('lrc' + i);
    if (el) {
      const rect = el.getBoundingClientRect();
      if (rect.top < window.innerHeight && rect.bottom > 0) {
        lyricElements.push({
          index: i,
          element: el,
          rect: rect,
          time: dataArray[i].time,
          centerY: rect.top + rect.height / 2,
        });
      }
    }
  }

  let nearestLine = null;
  let minDistance = Infinity;

  for (const line of lyricElements) {
    const distance = Math.abs(clickY - line.centerY);
    if (distance < minDistance) {
      minDistance = distance;
      nearestLine = line;
    }
  }

  if (nearestLine) {
    emit("lyric-click", nearestLine.time);
  } else {
    emit("lyric-click", time);
  }
};

// 组件挂载时初始化
onMounted(() => {
  nextTick(() => {
    forceScrollToCurrent();
  });
});

// 组件卸载时清理资源
onUnmounted(() => {
  if (resizeObserver) {
    try { resizeObserver.disconnect(); } catch {}
    resizeObserver = null;
  }

  if (hoverDetectTimer) {
    clearTimeout(hoverDetectTimer);
  }

  if (hoverTimer) {
    clearTimeout(hoverTimer);
  }
});
</script>

<style lang="scss" scoped>
.desktop-lyrics-content {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  position: relative;

  // 歌曲信息
  .song-info {
    padding: 2.5px 0;
    text-align: center;
    background: transparent;
    display: flex;
    flex-direction: column;
    justify-content: center;
    min-height: auto;

    .song-name {
      font-weight: bold;
      color: #fff;
      margin-bottom: 2px;
      line-height: 1.2;
    }

    .song-artist {
      color: rgba(255, 255, 255, 0.6);
      line-height: 1.2;
    }
  }

  // 歌词容器
  .lyrics-container {
    flex: 1;
    position: relative;
    overflow: hidden;
    display: flex;
    min-height: 0;
  }

  // 歌词滚动条
  .lyrics-scrollbar {
    width: 100%;
    height: 100%;
    overflow-y: auto; /* 只允许垂直滚动 */
    overflow-x: hidden; /* 禁止水平滚动 */
    position: relative;
    background: transparent;
    box-sizing: border-box;
    display: flex;
    flex-direction: column; // 垂直排列
    align-items: center; // 子元素水平居中
    text-align: center;

    // 隐藏滚动条
    scrollbar-width: none; /* Firefox */
    -ms-overflow-style: none; /* IE/Edge */
    &::-webkit-scrollbar {
      width: 0 !important;
      height: 0 !important;
      display: none !important;
    }
  }
  
  // 锁定状态下移除背景
  &.locked {
    .lyrics-scrollbar {
      background: transparent;
    }
  }

  // 歌词包裹器
  .lyrics-wrapper {
    width: 100%;
    min-height: 100%;
    padding: 0;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    align-items: center;
  }


  // 歌词行
  .lyric-line {
    display: flex;
    flex-direction: column;
    padding: 0;
    margin: 0;
    border-radius: 8px;
    transition: all 0.35s ease;
    transform-origin: center;
    cursor: default;
    width: fit-content; // 让宽度适应内容
    align-self: center; // 在父容器中居中对齐
    max-width: 100%;
    pointer-events: auto;
    position: relative;
    z-index: 1;
    text-align: center;

    // 使用伪元素作为背景和交互区域
    &::before {
      content: '';
      position: absolute;
      top: var(--expand-top, -10px);
      bottom: var(--expand-bottom, -10px);
      left: 50%;
      transform: translateX(-50%);
      width: max(calc(90% - 30px), 50px); // 使用 max 确保最小宽度
      border-radius: 60px;
      background-color: transparent;
      z-index: -1;
      pointer-events: auto;
      transition: background-color 0.3s, opacity 0.3s;
      opacity: 0;
    }

    &.clickable {
      cursor: pointer;

      &:active {
        transform: scale(0.98);
      }
    }

    .lyric-text {
      display: inline-block;
      font-weight: bold;
      color: rgba(255, 255, 255, 0.3);
      overflow-wrap: break-word;
      line-height: 1.25;
      max-width: 100%;
      transition: color 0.3s;
      pointer-events: auto;
      margin-right: calc(-1 * var(--letter-spacing, 0px));
    }

    .lyric-tran {
      margin-top: 6px;
      color: rgba(255, 255, 255, 0.1);
      line-height: 1.3;
      transition: color 0.3s;
      pointer-events: auto;
      margin-right: calc(-1 * var(--letter-spacing, 0px));
    }

    .lyric-roma {
      margin-top: 4px;
      color: rgba(255, 255, 255, 0.1);
      line-height: 1.1;
      transition: color 0.3s;
      pointer-events: auto;
      margin-right: calc(-1 * var(--letter-spacing, 0px));
    }

    &.on {
      .lyric-text {
        color: #FFFFFF;
      }

      .lyric-tran,
      .lyric-roma {
        color: rgba(255, 255, 255, 0.6);
      }
    }

    &.manual-hover {
      opacity: 1 !important;

      // 伪元素显示(用于调试)
      &::before {
        background-color: rgba(255, 255, 255, 0);
        opacity: 1;
        transform: translateX(-50%) scale(1);
      }
    }
  }

  // 逐字歌词布局样式
  .lyric-line.lyric-line-yrc {
    .lyric-text.lyric-text-yrc {
      display: flex !important;
      flex-wrap: wrap;
      justify-content: center;
      width: auto;
      max-width: 100%;
      pointer-events: auto;
      row-gap: 0;
      column-gap: var(--letter-spacing, 0px);  // 字间距
      margin-left: 0;
      margin-right: 0;
    }
  }

  .lyric-line.lyric-line-yrc.lyric-line-yrc-english {
    .lyric-text.lyric-text-yrc {
      row-gap: 0.1em;
      column-gap: calc(0.28em + var(--letter-spacing, 0px) * 1.6);   // 单词间距
    }
  }

  // 逐字歌词单词样式
  .lyric-line.lyric-line-yrc {
    .lyric-word {
      position: relative;
      display: inline-block;
      // 抵消最后一个字符的 letter-spacing
      margin-right: calc(-1 * var(--letter-spacing, 0px));

      .word-base {
        opacity: 1;
        transition: opacity 0.35s;
        color: rgba(255, 255, 255, 0.3);
        font-weight: inherit;
        letter-spacing: inherit;
      }

      .word-filler {
        opacity: 0;
        position: absolute;
        left: 0;
        top: 0;
        will-change: -webkit-mask-position-x;
        color: #FFFFFF;
        font-weight: inherit;
        letter-spacing: inherit;
        mask-image: linear-gradient(
          to right,
          rgb(0, 0, 0) 45.4545454545%,
          rgba(0, 0, 0, 0) 54.5454545455%
        );
        mask-size: 220% 100%;
        mask-repeat: no-repeat;
        -webkit-mask-image: linear-gradient(
          to right,
          rgb(0, 0, 0) 45.4545454545%,
          rgba(0, 0, 0, 0) 54.5454545455%
        );
        -webkit-mask-size: 220% 100%;
        -webkit-mask-repeat: no-repeat;
        -webkit-mask-position-x: 100%;
        transition-property: -webkit-mask-position-x, transform, opacity;
        transition-timing-function: linear, ease, ease;
      }

      &.word-space {
        margin-right: 0.3em;
      }
    }

    // 非播放行状态
    &:not(.on) {
      .lyric-word {
        .word-base {
          color: rgba(255, 255, 255, 0.3);
        }

        .word-filler {
          opacity: 0;
        }
      }
    }

    // 滚动点亮状态
    &.manual-hover {
      .lyric-word {
        .word-base {
          color: rgba(255, 255, 255, 0.7)
        }
      }
    }

    // 播放中行状态
    &.on {
      .lyric-word {
        // 真正的逐字歌词：word-base 保持 30% 透明度，word-filler 显示白色动画
        .word-base {
          color: rgba(255, 255, 255, 0.3);
        }

        .word-filler {
          opacity: 1;
          color: #FFFFFF;
          text-shadow: 0 0 1px rgba(0, 0, 0, 0.3);
        }

        // 常规歌词（中文和英文）：word-base 显示完全白色，无 word-filler 动画
        &.lyric-word-regular {
          .word-base {
            color: #FFFFFF;
          }
        }
      }
    }
  }

  // 无歌词提示
  .no-lyrics {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    font-size: 18px;
    color: rgba(255, 255, 255, 0.7);
    text-align: center;
    width: 90%;
    
  }

  // 对齐方式
  &.align-left {
    .lyrics-scrollbar,
    .lyric-line {
      text-align: left;
    }

    .lyric-line {
      align-items: flex-start;
      transform-origin: left center;
    }
  }

  &.align-center {
    .lyrics-scrollbar,
    .lyric-line {
      text-align: center;
    }

    .lyric-line {
      align-items: center;
      transform-origin: center;
    }
  }

  &.align-right {
    .lyrics-scrollbar,
    .lyric-line {
      text-align: right;
    }

    .lyric-line {
      align-items: flex-end;
      transform-origin: right center;
    }
  }

  // 淡入淡出动画
  .fade-enter-active,
  .fade-leave-active {
    transition: opacity 0.3s;
  }

  .fade-enter-from,
  .fade-leave-to {
    opacity: 0;
  }
}
</style>