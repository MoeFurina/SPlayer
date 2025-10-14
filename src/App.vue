<template>
  <Provider>
    <!--userAgreement ref="userAgreementRef"/-->
    <!-- 主框架 -->
    <n-layout :class="['all-layout', { 'full-player': showFullPlayer }]">
      <!-- 导航栏 -->
      <n-layout-header bordered>
        <MainNav />
      </n-layout-header>
      <!-- 主内容 - 有侧边栏 -->
      <n-layout
        v-if="showSider"
        :class="{
          'body-layout': true,
          'player-bar': music.getPlaySongData?.id && showPlayBar,
        }"
        position="absolute"
        has-sider
      >
        <!-- 侧边栏 -->
        <n-layout-sider
          :collapsed="asideMenuCollapsed"
          :native-scrollbar="false"
          :collapsed-width="64"
          :width="240"
          class="main-sider"
          show-trigger="bar"
          collapse-mode="width"
          bordered
          @collapse="asideMenuCollapsed = true"
          @expand="asideMenuCollapsed = false"
        >
          <div class="sider-all">
            <Menu />
          </div>
        </n-layout-sider>
        <!-- 页面区 -->
        <n-layout :native-scrollbar="false" embedded>
          <MainLayout />
        </n-layout>
      </n-layout>
      <!-- 主内容 - 无侧边栏 -->
      <n-layout-content
        v-else
        :class="{
          'body-layout': true,
          'player-bar': music.getPlaySongData?.id && showPlayBar,
        }"
        :native-scrollbar="false"
        position="absolute"
        embedded
      >
        <MainLayout />
      </n-layout-content>
    </n-layout>
    <!-- 主播放器 -->
    <MainControl />
    <!-- 全屏播放器 -->
    <FullPlayer />
    <!-- 全局播放列表 -->
    <n-config-provider v-if="showFullPlayer" :theme="darkTheme">
      <Playlist />
    </n-config-provider>
    <Playlist v-else />
    
    <!-- 全局水印 -->
    <!--n-watermark
      :font-size="16"
      :line-height="16"
      :width="384"
      :height="384"
      :x-offset="'calc(100vw - 384 - 20)'"
      :y-offset="'calc(100vh - 384 - 40)'"
      content="当前版本为测试版本, 不代表最终品质"
      cross
      fullscreen="false"
    /-->
  
  </Provider>
</template>

<script setup>
import { storeToRefs } from "pinia";
import { useRouter } from "vue-router";
import { darkTheme, NButton } from "naive-ui";
import { musicData, siteStatus, siteSettings } from "@/stores";
import { checkPlatform } from "@/utils/helper";
import { initPlayer, playOrPause, changePlayIndex, setVolume } from "@/utils/Player";
import userAgreement from "@/components/Modal/UserAgreement.vue";
import userSignIn from "@/utils/userSignIn";
import globalShortcut from "@/utils/globalShortcut";
import globalEvents from "@/utils/globalEvents";
import { initDesktopLyricsControls } from "@/utils/desktopLyricsSync";
import packageJson from "@/../package.json";


const router = useRouter();
const music = musicData();
const status = siteStatus();
const settings = siteSettings();
const { autoPlay, showSider, autoSignIn, autoCheckUpdates } = storeToRefs(settings);
const { showPlayBar, asideMenuCollapsed, showFullPlayer } = storeToRefs(status);
const userAgreementRef = ref(null);


// 公告数据
const annShow =
  import.meta.env.RENDERER_VITE_ANN_TITLE && import.meta.env.RENDERER_VITE_ANN_CONTENT
    ? true
    : false;
const annType = import.meta.env.RENDERER_VITE_ANN_TYPE || "error";
const annTitle = import.meta.env.RENDERER_VITE_ANN_TITLE || "超限警告";
const annContene = import.meta.env.RENDERER_VITE_ANN_CONTENT || "本站资源限制可能随时超出, 推荐在Github页面下载客户端或者自部署使用; 网站资源均来自第三方, 仅供学习交流使用, 请勿用于商业用途";
const annDuration = Number(import.meta.env.RENDERER_VITE_ANN_DURATION) || 8000;

// PWA
if ("serviceWorker" in navigator) {
  // 更新完成提醒
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (checkPlatform.electron()) {
      $notification.create({
        title: "🎉 有更新啦",
        content: "检测到软件内资源有更新，是否重新启动软件以应用更新？",
        meta: "当前版本 v " + (packageJson.version || "1.0.0"),
        action: () =>
          h(
            NButton,
            {
              text: true,
              type: "primary",
              onClick: () => {
                if (checkPlatform.electron() && window.electron?.ipcRenderer) {
                  window.electron.ipcRenderer.send("window-relaunch");
                }
              },
            },
            {
              default: () => "更新",
            },
          ),
        onAfterLeave: () => {
          $message.info("已取消本次更新，更新将在下次启动软件后生效", {
            duration: 6000,
          });
        },
      });
    } else {
      console.info("站点资源有更新，请刷新以应用更新");
      $notification.create({
        title: "🎉 有更新啦",
        content: "检测到网站内资源有更新，是否刷新网站以应用更新？",
        meta: "当前版本 v " + (packageJson.version || "1.0.0"),
        action: () =>
          h(
            NButton,
            {
              text: true,
              type: "primary",
              onClick: () => {
                window.location.reload(true);
              },
            },
            {
              default: () => "更新",
            },
          ),
        onAfterLeave: () => {
          $message.info("已取消本次更新，更新将在下次启动软件后生效", {
            duration: 6000,
          });
        },
      });
    }
  });
}

// 自动检查更新
const checkUpdates = () => {
  if (!checkPlatform.electron()) return false;
  if (window.electron?.ipcRenderer) {
    window.electron.ipcRenderer.send("check-updates");
  }
};

// 显示公告
const showAnnouncements = () => {
  if (annShow) {
    $notification[annType]({
      content: annTitle,
      meta: annContene,
      duration: annDuration,
    });
  }
};


// 检查PWA更新
const checkUpdatesWeb = async () => {
  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.ready;
      const update = await registration.update();
      
      if (update) {
        console.info('正在检查PWA更新...');
      }
    } catch (error) {
      console.error('PWA更新检查失败:', error);
      $message.error('PWA更新检查失败, 请尝试在"其他"设置中清除PWA缓存', {
        duration: 2000
      });
    }
  }
};

// 站点源代码出现错误 or 网络出现问题
const canNotConnect = (error) => {
  console.error("网络连接错误：", error.message);
  $notification.error({
    content: "呃, 好像出了点问题(っ °Д °;)っ",
    meta: "如果是源代码出现问题, 请联系开发者解决; 如果是您的网络出现问题, 请检查您的网络适配器后重试",
    duration: 5000,
  });
  $message.error("网络连接错误：" + error.message, {
    duration: 0,
    closable: true, 
  })
};

// 网页端键盘事件
const handleKeyUp = (event) => {
  globalShortcut(event, router);
};

onMounted(async () => {
  // 挂载方法
  window.$canNotConnect = canNotConnect;
  // 主播放器
  await initPlayer(autoPlay.value);
  // 初始化字体设置
  try {
    const storedSettings = JSON.parse(localStorage.getItem('siteSettings') || '{}');
    const { webFonts, fontBold, lyricsFont } = storedSettings;
    if (webFonts && lyricsFont) {
      document.documentElement.style.setProperty('--main-font-family', `"${webFonts}", system-ui, -apple-system, sans-serif`);
      document.documentElement.style.setProperty('--main-font-family-lyric', `"${lyricsFont}", system-ui, -apple-system, sans-serif`);
    }
    if (typeof fontBold === 'boolean') {
      document.documentElement.style.setProperty('font-weight', fontBold ? 'bold' : 'normal');
    }
  } catch (error) {
    console.warn('初始化字体设置失败:', error);
  }
  // 更改全局字体
  settings.changeSystemFonts();
  // 全局事件
  globalEvents(router);
  // 键盘监听
  if (!checkPlatform.electron()) {
    window.addEventListener("keyup", handleKeyUp);
  } else {
    // ✅ 修复：在 onMounted 中安全地初始化快捷键
    try {
      const { useShortcutStore } = await import("@/stores/shortcut");
      const shortcutStore = useShortcutStore();
      const { formatForGlobalShortcut } = await import("@/utils/helper");
      // 先发送列表到主进程，确保主进程缓存到位后再注册
      if (window.electron?.ipcRenderer) {
        // 发送前进行格式化，避免主进程第一次 register 失败
        const normalizedList = JSON.parse(JSON.stringify(shortcutStore.shortcutList));
        Object.values(normalizedList).forEach((item) => {
          item.globalShortcut = formatForGlobalShortcut(item.globalShortcut || "");
        });
        window.electron.ipcRenderer.send("set-shortcut-list", normalizedList);
      }
      // 注册全局快捷键（包含格式化与主进程注册调用）
      await shortcutStore.registerAllShortcuts();

      // 统一由 Player 初始化全局快捷键监听，内部做防重复保护
      const playerMod = await import("@/utils/Player.js");
      if (typeof playerMod.initShortcutListeners === "function") {
        playerMod.initShortcutListeners();
      } else {
        console.warn("initShortcutListeners 不可用，跳过额外初始化（由 initPlayer 负责）");
      }
      
      // 调试：检查关键全局快捷键是否已被主进程成功注册
      try {
        if (window.electron?.ipcRenderer) {
          const toCheck = [
            formatForGlobalShortcut(shortcutStore.shortcutList.playOrPause.globalShortcut),
            formatForGlobalShortcut(shortcutStore.shortcutList.playPrev.globalShortcut),
            formatForGlobalShortcut(shortcutStore.shortcutList.playNext.globalShortcut),
            formatForGlobalShortcut(shortcutStore.shortcutList.volumeUp.globalShortcut),
            formatForGlobalShortcut(shortcutStore.shortcutList.volumeDown.globalShortcut),
          ];
          const results = await Promise.all(
            toCheck.map((acc) => window.electron.ipcRenderer.invoke("is-shortcut-registered", acc))
          );
          console.info(
            "全局快捷键注册状态:",
            toCheck.map((acc, i) => `${acc}: ${results[i] ? "已注册" : "未注册"}`).join(", ")
          );
        }
      } catch (e) {
        console.warn("检测全局快捷键注册状态失败:", e);
      }
      
      // 监听键盘事件处理本地快捷键（使用捕获阶段，避免内层组件阻止冒泡导致无法触发）
      window.addEventListener(
        "keydown",
        (e) => {
          globalShortcut(e, router);
        },
        { capture: true }
      );
      
      console.log("快捷键初始化完成");
    } catch (error) {
      console.warn("快捷键初始化失败:", error);
    }
  }
  // 自动签到
  if (autoSignIn.value) await userSignIn();
  // 检查更新
  // if (autoCheckUpdates.value) checkUpdates();
  // 显示公告
  showAnnouncements();
  // 检查PWA更新
  checkUpdatesWeb();
  
  // 初始化桌面歌词控制（仅在Electron环境）
  if (checkPlatform.electron() && typeof initDesktopLyricsControls === 'function') {
    try {
      initDesktopLyricsControls();
      console.log("桌面歌词控制初始化成功");
    } catch (error) {
      console.warn("桌面歌词控制初始化失败:", error);
    }
  }
});

onUnmounted(() => {
  if (!checkPlatform.electron()) {
    window.removeEventListener("keyup", handleKeyUp);
  }
});
</script>

<style lang="scss" scoped>
.all-layout {
  height: 100%;
  transition:
    transform 0.3s,
    opacity 0.3s;
  .n-layout-header {
    height: 60px;
    display: flex;
    flex-direction: row;
    align-items: center;
    -webkit-app-region: drag;
  }
  .body-layout {
    top: 60px;
    transition: bottom 0.3s;
    .main-sider {
      :deep(.n-scrollbar-content) {
        height: 100%;
      }
      .sider-all {
        height: 100%;
      }
      @media (max-width: 900px) {
        display: none;
      }
    }
    &.player-bar {
      bottom: 80px;
    }
  }
  &.full-player {
    opacity: 0;
    transform: scale(0.9);
  }
}
</style>
