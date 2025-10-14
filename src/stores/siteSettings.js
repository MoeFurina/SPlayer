// 站点设置
import { defineStore } from "pinia";

const useSiteSettingsStore = defineStore("siteSettings", {
  state: () => {
    return {
      // 基础配置
      readProtocol: false,
      closeTip: true, // 关闭软件提醒弹窗
      closeType: "hide", // 关闭方式 close 直接关闭 / hide 最小化到任务栏
      showTaskbarProgress: false, // 显示歌曲任务栏进度
      showSearchHistory: true, // 搜索历史
      autoSignIn: false, // 自动签到
      showGithub: true, //展示Github仓库
      showSider: true, // 显示侧边栏
      siderShowCover: false, // 侧边栏显示封面
      autoCheckUpdates: true, // 自动检查更新
      systemFonts: "HarmonyOS Sans", // 全局字体 (仅 Electron)
      justLyricArea: false, // 仅在歌词区域生效
      hiddenVipTags: false, // 隐藏 VIP 标签
      webFonts: "LXGW WenKai", // 网页字体
      fontBold: true, // 字体加粗
      showVersion: false, // 显示版本号
      // 主题部分
      themeType: "dark",
      themeAuto: false,
      themeTypeName: "red",
      themeTypeData: {},
      themeAutoCover: false, // 主题色跟随封面
      themeAutoCoverType: "secondary",
      // 播放部分
      playCoverType: "cover", // 播放器样式
      songLevel: "exhigh", // 歌曲音质
      autoPlay: false, // 程序启动时自动播放
      songVolumeFade: true, // 歌曲渐入渐出
      useUnmServer: true, // 是否使用网易云解灰
      countDownShow: true, // 是否显示前奏等待
      bottomLyricShow: true, // 底栏歌词显示
      playerBackgroundType: "blur", // 播放器背景类别  animation 流动 / blur 模糊
      memorySeek: true, // 记忆上次播放位置
      playSearch: false, // 是否播放全部搜索结果
      showPlaylistCount: true, // 是否显示播放列表数量
      showSpectrums: false, // 是否显示音乐频谱
      useMusicCache: false, // 是否采用音乐缓存
      customMusicSource: "pyncmd,bodian,qq,migu,kugou", // 自定义音乐源
      // 数量部分
      loadSize: 50, // 每页加载数量
      // 歌词部分
      lrcMousePause: false, // 鼠标移入歌词区域暂停滚动
      lyricsFontSize: 36, // 歌词大小
      lyricsFont: "HarmonyOS sans", // 歌词字体
      lyricsBlur: true, // 歌词模糊
      lyricsBold: true, // 歌词加粗
      showYrc: true, // 是否显示逐字歌词
      showYrcAnimation: true, // 是否显示逐字歌词动画
      lyricsPosition: "left", // 歌词位置
      lyricsBlock: "start", // 歌词滚动位置
      alignAnchor: "top", // 歌词对齐位置
      showTransl: true, // 是否显示歌词翻译
      showRoma: true, // 是否显示歌词音译
      useAMLyrics: false, // 使用苹果音乐歌词
      useAMSpring: false, // 使用苹果音乐歌词弹簧动画
      /* AMLL歌词参数设置 */
      useTTMLFormat: false, // 使用TTML格式歌词
      springParams: { // 弹簧参数
        posX: {
          mass: 1,
          damping: 10,
          stiffness: 100
        },
        posY: {
          mass: 1,
          damping: 15,
          stiffness: 100
        },
        scale: {
          mass: 1,
          damping: 20,
          stiffness: 100
        }
      },
      // 下载部分
      downloadPath: null, // 默认下载路径
      downloadMeta: true, // 同时下载元信息
      downloadCover: true, // 同时下载封面
      downloadLyrics: true, // 同时下载歌词
      downloadLyricsToFile: true,
      downloadCoverToFile: true,
      // 网络部分
      useCustomNCMServer: false, // 是否使用自定义NCM服务器
      ncmServer: "https://music-api.example.com", // NCM服务器
      useCustomUNMServer: false, // 是否使用自定义UNM服务器
      unmServer: "https://unm-server.example.com", // UNM服务器
      useRealIP: true, // 是否使用真实IP地址
      realIP: "116.25.146.177", // 真实IP地址
      proxyProtocol: "off", // 代理协议
      proxyServe: "127.0.0.1", // 代理地址
      proxyPort: 80, // 代理端口
      
      // ==================
      // 桌面歌词设置
      // ==================
      
      // 基础开关
      desktopLyricsEnabled: false,           // 桌面歌词总开关
      desktopLyricsAutoShow: false,          // 启动时自动显示
      desktopLyricsAlwaysOnTop: true,        // 总是置顶
      desktopLyricsAutoLock: true,           // 自动锁定（10秒后）
      desktopLyricsRightClickToggleLock: true, // 右击按钮切换锁定
      
      // 显示内容
      desktopLyricsShowTitle: true,          // 显示歌曲标题
      desktopLyricsShowArtist: true,         // 显示艺术家
      
      // 外观设置
      desktopLyricsLines: 3,                 // 显示行数（3-5）
      desktopLyricsAlignment: "center",      // 对齐方式：left/center/right
      desktopLyricsScrollPosition: "center",    // 滚动位置：top/center
      
      // 字体设置
      desktopLyricsFontSize: 36,             // 字体大小
      desktopLyricsFont: "HarmonyOS sans",   // 字体
      desktopLyricsBold: true,               // 加粗
      desktopLyricsColor: "#FFFFFF",         // 主色
      desktopLyricsColorSecondary: "#999999", // 次色
      desktopLyricsStroke: false,            // 描边
      desktopLyricsStrokeColor: "#000000",   // 描边颜色
      desktopLyricsStrokeWidth: 1,           // 描边宽度
      
      // 透明度设置
      desktopLyricsOpacity: 0.9,             // 窗口透明度（0-1）
      desktopLyricsHoverOpacity: 0.95,       // 鼠标移入透明度
      desktopLyricsHoverThreshold: 300,      // 快速移入移出阈值（毫秒）
      
      // 交互设置
      desktopLyricsHoverPause: true,         // 鼠标移入暂停滚动
      desktopLyricsClickJump: true,          // 点击歌词跳转播放
    };
  },
  getters: {},
  actions: {
    // 调整主题类别
    setThemeType(value) {
      this.themeType = value;
      this.themeAuto = false;
      $message.info(`已切换至${value === "light" ? "浅色" : "深色"}模式`, { showIcon: false });
    },
    setLyricStyle(style) { 
      this.lyricsStyle = style;
      if (style === 'apple-music') { 
        this.justLyricArea = true;
      }
    },
    // 更改系统字体
    changeSystemFonts(font = this.webFonts) {
      this.webFonts = font;
      const root = document.documentElement;
      if (!root) return false;
      root.style.setProperty(
        "--main-font-family",
        `"${font}", "HarmonyOS_Regular", system-ui, -apple-system, sans-serif`,
      );
    },
    changeLyricsFonts(font = this.lyricsFont) {
      this.lyricsFont = font;
      const root = document.documentElement;
      if (!root) return false;
      root.style.setProperty(
        "--main-font-family-lyric",
        `"${font}", "HarmonyOS_Regular", system-ui, -apple-system, sans-serif`,
      );
    },
    
    // 切换桌面歌词开关
    toggleDesktopLyrics() {
      // 如果已经在处理中，不再重复处理
      if (this._isTogglingLyrics) {
        console.log("桌面歌词切换操作进行中，忽略重复调用");
        return;
      }
      
      // 设置锁定标记，防止重复调用
      this._isTogglingLyrics = true;
      
      try {
        // 计算新状态
        const newState = !this.desktopLyricsEnabled;
        
        // 先更新本地状态，防止多次触发
        this.desktopLyricsEnabled = newState;
        
        console.log(`桌面歌词状态切换: ${newState ? '开启' : '关闭'}`);
        
        // 通知主进程切换窗口显示
        if (typeof electron !== "undefined") {
          // 直接发送确切的显示或隐藏命令，而不是toggle
          const command = newState ? "desktop-lyrics-show" : "desktop-lyrics-hide";
          console.log(`发送命令: ${command}`);
          
          // 发送IPC命令
          electron.ipcRenderer.send(command);
          
          // 如果是开启，则同步设置和歌词数据
          if (newState) {
            // 延迟一点再同步设置和数据，确保窗口已创建
            setTimeout(() => {
              this.syncDesktopLyricsSettings();
              
              // 导入并调用同步所有数据的函数
              try {
                import('@/utils/desktopLyricsSync').then(module => {
                  console.log("开启桌面歌词后，手动触发数据同步");
                  module.syncAllToDesktopLyrics();
                }).catch(err => {
                  console.error("导入同步模块失败:", err);
                });
              } catch (syncError) {
                console.error("同步歌词数据失败:", syncError);
              }
            }, 300);
          }
          
          // 显示提示消息
          $message.info(
            newState ? "桌面歌词已开启" : "桌面歌词已关闭",
            { showIcon: false }
          );
        }
        
        // 延迟解除锁定，防止快速连续点击
        setTimeout(() => {
          this._isTogglingLyrics = false;
        }, 500);
      } catch (error) {
        console.error("桌面歌词切换出错:", error);
        // 确保即使出错也解除锁定
        this._isTogglingLyrics = false;
      }
    },
    
    // 同步当前桌面歌词设置到窗口
    syncDesktopLyricsSettings() {
      if (typeof electron !== "undefined") {
        try {
          // 同步所有桌面歌词相关设置
          const settings = {
            desktopLyricsShowTitle: this.desktopLyricsShowTitle,
            desktopLyricsShowArtist: this.desktopLyricsShowArtist,
            desktopLyricsFontSize: this.desktopLyricsFontSize,
            desktopLyricsAlignment: this.desktopLyricsAlignment,
            desktopLyricsScrollPosition: this.desktopLyricsScrollPosition,
            desktopLyricsHoverPause: this.desktopLyricsHoverPause,
            desktopLyricsClickJump: this.desktopLyricsClickJump,
            desktopLyricsOpacity: this.desktopLyricsOpacity,
            desktopLyricsHoverOpacity: this.desktopLyricsHoverOpacity,
            desktopLyricsRightClickToggleLock: this.desktopLyricsRightClickToggleLock,
            showTransl: this.showTransl,
            showRoma: this.showRoma,
            showYrc: this.showYrc
          };
          
          console.log("同步桌面歌词设置到窗口");
          console.log("主窗口桌面歌词滚动位置设置值:", settings.desktopLyricsScrollPosition);
          electron.ipcRenderer.send("desktop-lyrics-update-settings", settings);
        } catch (error) {
          console.error("同步桌面歌词设置失败：", error);
        }
      }
    },
    
    // 更新桌面歌词设置
    updateDesktopLyricsSettings(settings) {
      // 更新本地设置
      Object.assign(this, settings);
      
      // 通知主进程更新设置
      if (typeof electron !== "undefined") {
        console.log("更新桌面歌词设置并同步");
        console.log("更新后的桌面歌词滚动位置设置值:", settings.desktopLyricsScrollPosition);
        electron.ipcRenderer.send("desktop-lyrics-update-settings", settings);
      }
    },
    
    // 强制清除桌面歌词启用状态（用于错误处理）
    forceClearDesktopLyricsEnabled() {
      // 不使用toggleDesktopLyrics方法，以避免触发IPC通信
      console.log("强制清除桌面歌词启用状态");
      this.desktopLyricsEnabled = false;
      this._isTogglingLyrics = false;
    },
    
    // 强制重置桌面歌词滚动位置为居中（调试用）
    forceResetScrollPosition() {
      console.log("强制重置桌面歌词滚动位置为居中");
      this.desktopLyricsScrollPosition = "center";
      this.syncDesktopLyricsSettings();
    }
  },
  
  // 数据持久化
  persist: [
    {
      key: "siteSettings",
      storage: localStorage,
    },
  ],
});

export default useSiteSettingsStore;
