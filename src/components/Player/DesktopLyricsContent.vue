<!-- 桌面歌词内容组件 - 复用Lyric.vue的渲染逻辑 -->
<template>
  <div
    :class="['desktop-lyrics-content', `align-${alignment}`]"
    @mouseenter="handleMouseEnter"
    @mouseleave="handleMouseLeave"
  >
    <!-- 歌曲信息 -->
    <div v-if="showSongInfo && currentSong.name && !isLocked" class="song-info">
      <div class="song-name">{{ currentSong.name }}</div>
      <div v-if="showArtist" class="song-artist">{{ currentSong.artists }}</div>
    </div>

    <!-- 歌词滚动区域 -->
    <div ref="lyricsContainer" class="lyrics-container">
      <Transition name="fade" mode="out-in">
        <div
          v-if="lyricsData.length > 0"
          :key="lyricsData[0]?.content"
          class="lyrics-wrapper"
        >
          <div ref="lyricScroll" class="lyrics-scrollbar native" style="overflow:auto;">
            <!-- 普通歌词 -->
            <template v-if="!showYrc || !hasYrc">
              <!-- 歌词行 -->
              <div
                v-for="(item, index) in lyricsData"
                :id="'lrc' + index"
                :key="index"
                :class="{ 
                  'lyric-line': true, 
                  'on': currentIndex === index,
                  'clickable': enableClickJump,
                }"
                :style="getLyricLineStyle(index)"
                @click="handleLyricClick(item.time)"
              >
                <!-- 主歌词 -->
                <span
                  :style="{ fontSize: fontSize + 'px' }"
                  class="lyric-text"
                >
                  {{ item.content }}
                </span>
                
                <!-- 翻译 -->
                <span
                  v-if="showTransl && hasLrcTran && item.tran"
                  :style="{ fontSize: fontSize - 10 + 'px' }"
                  class="lyric-tran"
                >
                  {{ item.tran }}
                </span>
                
                <!-- 音译 -->
                <span
                  v-if="showRoma && hasLrcRoma && item.roma"
                  :style="{ fontSize: fontSize - 12 + 'px' }"
                  class="lyric-roma"
                >
                  {{ item.roma }}
                </span>
              </div>
            </template>

            <!-- 逐字歌词（阶段三实现） -->
            <template v-else>
              <!-- 逐字歌词渲染 -->
            </template>
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

// Props
const props = defineProps({
  // 歌词数据
  lyricsData: {
    type: Array,
    default: () => [],
  },
  // 当前歌词索引
  currentIndex: {
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
  // 歌词能力标识
  hasYrc: {
    type: Boolean,
    default: false,
  },
  hasLrcTran: {
    type: Boolean,
    default: false,
  },
  hasLrcRoma: {
    type: Boolean,
    default: false,
  },
  // 显示设置
  showYrc: {
    type: Boolean,
    default: false,
  },
  showTransl: {
    type: Boolean,
    default: true,
  },
  showRoma: {
    type: Boolean,
    default: true,
  },
  showSongInfo: {
    type: Boolean,
    default: true,
  },
  showArtist: {
    type: Boolean,
    default: true,
  },
  // 锁定状态
  isLocked: {
    type: Boolean,
    default: false,
  },
  // 样式设置
  fontSize: {
    type: Number,
    default: 36,
  },
  alignment: {
    type: String,
    default: "center", // left/center/right
  },
  scrollPosition: {
    type: String,
    default: "center", // top/center
  },
  // 交互设置
  enableHoverPause: {
    type: Boolean,
    default: true,
  },
  enableClickJump: {
    type: Boolean,
    default: true,
  },
});

// Emits
const emit = defineEmits(["lyric-click", "mouse-enter", "mouse-leave"]);

// Refs
const lyricScroll = ref(null);
const lyricsContainer = ref(null);
const isMouseHover = ref(false);
let resizeObserver = null;

// 无歌词提示文本
const noLyricsText = computed(() => {
  if (!props.currentSong.name) return "等待播放...";
  return "暂无歌词";
});


const forceScrollToCurrent = (retryCount = 0) => {
  console.log("强制滚动到当前歌词:", {
    currentIndex: props.currentIndex,
    lyricsLength: props.lyricsData.length,
    scrollPosition: props.scrollPosition,
    retryCount
  });
  
  nextTick(() => {
    const container = lyricScroll.value;
    if (!container && retryCount < 4) {
      console.log("容器未找到，重试滚动:", retryCount + 1);
      setTimeout(() => {
        forceScrollToCurrent(retryCount + 1);
      }, 80);
      return;
    }
    
    if (props.currentIndex >= 0 && props.currentIndex < props.lyricsData.length) {
      console.log("滚动到当前歌词索引:", props.currentIndex);
      scrollToLyric(props.currentIndex);
    } else if (props.lyricsData.length > 0) {
      console.log("前奏阶段，滚动到第一句歌词");
      scrollToLyric(0);
    }
  });
};

const getLyricLineStyle = (index) => {
  const isActive = index === props.currentIndex;
  return {
    transform: `scale(${isActive ? 1 : 0.86})`,
    opacity: isActive ? 1 : 0.3,
  };
};

const scrollToLyric = (index) => {
  console.log("🎵 scrollToLyric 被调用:", {
    index,
    lyricsLength: props.lyricsData.length,
    scrollPosition: props.scrollPosition,
    isMouseHover: isMouseHover.value,
    enableHoverPause: props.enableHoverPause
  });

  if (isMouseHover.value && props.enableHoverPause) {
    console.log("鼠标悬停暂停滚动，跳过");
    return;
  }

  if (index < 0 || index >= props.lyricsData.length) {
    console.log("无效的歌词索引，跳过滚动:", index);
    return;
  }

  nextTick(() => {
    const el = document.getElementById("lrc" + index);
    if (!el) {
      console.log("未找到歌词元素:", "lrc" + index);
      return;
    }

    const container = lyricScroll.value;
    if (!container) {
      console.log("未找到滚动容器");
      return;
    }

    console.log("找到元素和容器，准备滚动:", {
      element: el,
      container: container,
      elementText: el.textContent?.trim()
    });

    const containerHeight = container.clientHeight;
    const elementTop = el.offsetTop;
    const elementHeight = el.clientHeight;
    const currentScrollTop = container.scrollTop;
    
    const elementTopInView = elementTop - currentScrollTop;
    const elementBottomInView = elementTopInView + elementHeight;
    
    console.log("歌词滚动调试:", {
      index,
      containerHeight,
      elementTop,
      elementHeight,
      currentScrollTop,
      elementTopInView,
      elementBottomInView,
      scrollPosition: props.scrollPosition
    });

    if (props.scrollPosition === "center") {
      el.scrollIntoView({ 
        behavior: "smooth", 
        block: "center" 
      });
      
      console.log("统一居中滚动:", {
        index,
        elementTop,
        elementHeight,
        containerHeight,
        currentScrollTop,
        reason: "统一使用居中逻辑，让浏览器处理边界"
      });
    } else {
      el.scrollIntoView({ 
        behavior: "smooth", 
        block: "start" 
      });
      
      console.log("顶部对齐滚动:", {
        index,
        elementTop,
        containerHeight,
        currentScrollTop
      });
    }
  });
};

watch(
  () => props.currentIndex,
  (newIndex) => {
    console.log("歌词索引变化，触发滚动:", newIndex);
    forceScrollToCurrent();
  }
);

watch(
  () => props.lyricsData,
  (newLyrics) => {
    console.log("歌词数据变化，触发滚动:", {
      lyricsLength: newLyrics?.length || 0,
      currentIndex: props.currentIndex,
      isPlaying: props.isPlaying
    });
    if (newLyrics?.length > 0) {
      nextTick(() => {
        forceScrollToCurrent();
      });
    }
  }
);

watch(
  () => props.isPlaying,
  (isPlaying) => {
    console.log("播放状态变化，触发滚动:", isPlaying);
    if (isPlaying) {
      nextTick(() => {
        forceScrollToCurrent();
      });
    }
  }
);

const handleMouseEnter = () => {
  isMouseHover.value = true;
  emit("mouse-enter");
};

const handleMouseLeave = () => {
  isMouseHover.value = false;
  emit("mouse-leave");
  forceScrollToCurrent();
};

const handleLyricClick = (time) => {
  if (!props.enableClickJump) return;
  emit("lyric-click", time);
};

onMounted(() => {
  nextTick(() => {
    forceScrollToCurrent();
  });
});

onUnmounted(() => {
  if (resizeObserver) {
    try { resizeObserver.disconnect(); } catch {}
    resizeObserver = null;
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
    padding: 12px 20px;
    text-align: center;
    background: rgba(0, 0, 0, 0.3);
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);

    .song-name {
      font-size: 16px;
      font-weight: bold;
      color: #fff;
      margin-bottom: 4px;
    }

    .song-artist {
      font-size: 12px;
      color: rgba(255, 255, 255, 0.6);
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
    padding: 0 20px;
    overflow: auto;
    position: relative;
  }

  // 歌词包裹器
  .lyrics-wrapper {
    width: 100%;
    min-height: 100%;
    display: flex;
    flex-direction: column;
  }


  // 歌词行
  .lyric-line {
    display: flex;
    flex-direction: column;
    margin: 8px 0;
    padding: 12px 16px;
    border-radius: 8px;
    transition: all 0.35s ease;
    transform-origin: center;
    cursor: default;

    &.clickable {
      cursor: pointer;

      &:active {
        transform: scale(0.98);
      }
    }

    // 主歌词
    .lyric-text {
      font-weight: bold;
      color: #fff;
      word-wrap: break-word;
      transition: color 0.3s;
    }

    // 翻译
    .lyric-tran {
      margin-top: 6px;
      color: rgba(255, 255, 255, 0.6);
      transition: color 0.3s;
    }

    // 音译
    .lyric-roma {
      margin-top: 4px;
      color: rgba(255, 255, 255, 0.5);
      transition: color 0.3s;
    }

    // 高亮状态
    &.on {
      .lyric-text {
        color: var(--primary-color, #18a058);
      }

      .lyric-tran,
      .lyric-roma {
        color: rgba(255, 255, 255, 0.8);
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
    .lyric-line {
      align-items: flex-start;
      text-align: left;
      transform-origin: left center;
    }
  }

  &.align-center {
    .lyric-line {
      align-items: center;
      text-align: center;
      transform-origin: center;
    }
  }

  &.align-right {
    .lyric-line {
      align-items: flex-end;
      text-align: right;
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