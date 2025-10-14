/**
 * 桌面歌词数据同步和控制指令处理
 */
import { musicData, siteSettings, siteStatus } from "@/stores";
import { changePlayIndex, fadePlayOrPause, setSeek } from "@/utils/Player";

// 使用全局消息实例（如果存在）
const $message = window.$message || { 
  info: (msg) => console.log(`[消息]: ${msg}`) 
};

// 监听桌面歌词请求播放状态
if (typeof window.electron !== "undefined") {
  window.electron.ipcRenderer.on("desktop-lyrics-request-play-state", () => {
    console.log("收到桌面歌词播放状态请求，立即同步");
    syncPlayStateToDesktopLyrics();
  });
}

/**
 * 处理桌面歌词发来的控制指令
 * @param {Object} data 控制数据对象
 */
export const handleDesktopLyricsControl = ({ action, value }) => {
  const settings = siteSettings();

  switch (action) {
    case "playPause":
      // 获取当前播放状态，然后切换
      const status = siteStatus();
      const isCurrentlyPlaying = status.playState; // 使用正确的字段名
      console.log("桌面歌词播放控制:", { 
        currentPlayState: status.playState, 
        isCurrentlyPlaying,
        action: isCurrentlyPlaying ? "pause" : "play"
      });
      fadePlayOrPause(isCurrentlyPlaying ? "pause" : "play");
      // 轻微延时后同步播放状态
      setTimeout(() => {
        try { syncPlayStateToDesktopLyrics(); } catch (e) {}
      }, 80);
      break;

    case "prev":
      changePlayIndex("prev");
      break;

    case "next":
      changePlayIndex("next");
      break;

    case "seek":
      if (typeof value === "number") {
        setSeek(value);
        setTimeout(() => {
          try { syncPlayStateToDesktopLyrics(); } catch (e) {}
        }, 80);
      }
      break;

    case "fontSize":
      if (typeof value === "number") {
        settings.desktopLyricsFontSize = value;
        // 立即同步设置到桌面歌词窗口
        try { syncSettingsToDesktopLyrics(); } catch (e) {}
      }
      break;

    default:
      console.warn("未知的桌面歌词控制指令:", action);
  }
};

/**
 * 同步播放状态到桌面歌词窗口
 * 在播放状态更改时调用
 */
export const syncPlayStateToDesktopLyrics = () => {
  if (typeof window.electron === "undefined") return;
  
  const settings = siteSettings();
  const status = siteStatus();
  
  // 检查桌面歌词是否启用
  if (!settings.desktopLyricsEnabled) {
    console.log("桌面歌词未启用，跳过同步播放状态");
    return;
  }
  
  console.log("同步播放状态到桌面歌词:", {
    isPlaying: status.playState,
    playSeek: status.playSeek,
    lyricIndex: status.playSongLyricIndex,
  });
  
  window.electron.ipcRenderer.send("desktop-lyrics-update-play-state", {
    isPlaying: status.playState,
    playSeek: status.playSeek,
    lyricIndex: status.playSongLyricIndex,
  });
};

/**
 * 同步歌词数据到桌面歌词窗口
 * 在歌曲切换或歌词加载完成时调用
 */
export const syncLyricDataToDesktopLyrics = () => {
  if (typeof window.electron === "undefined") return;
  
  const settings = siteSettings();
  const store = musicData();
  
  // 检查桌面歌词是否启用
  if (!settings.desktopLyricsEnabled) {
    console.log("桌面歌词未启用，跳过同步歌词数据");
    return;
  }
  
  try {
    // 创建可序列化的歌词数据副本
    const lrcArray = store.playSongLyric?.lrc || [];
    
    console.log("同步歌词数据到桌面歌词:", {
      lrcLength: lrcArray.length,
      hasYrc: !!store.playSongLyric?.hasYrc,
      hasLrcTran: !!store.playSongLyric?.hasLrcTran,
      hasLrcRoma: !!store.playSongLyric?.hasLrcRoma,
      firstLyric: lrcArray[0]?.content || "无歌词"
    });
    
    // 确保歌词数组是可克隆的简单对象
    const simplifiedLrc = lrcArray.map(item => ({
      time: item.time || 0,
      content: item.content || "",
      tran: item.tran || "",
      roma: item.roma || ""
    }));
    
    window.electron.ipcRenderer.send("desktop-lyrics-update-lyric-data", {
      lrc: simplifiedLrc,
      hasYrc: !!store.playSongLyric?.hasYrc,
      hasLrcTran: !!store.playSongLyric?.hasLrcTran,
      hasLrcRoma: !!store.playSongLyric?.hasLrcRoma,
    });
  } catch (error) {
    console.error("准备歌词数据时出错:", error);
  }
};

/**
 * 同步歌曲信息到桌面歌词窗口
 * 在歌曲切换时调用
 */
export const syncSongInfoToDesktopLyrics = () => {
  if (typeof window.electron === "undefined") return;
  
  const settings = siteSettings();
  const store = musicData();
  
  // 检查桌面歌词是否启用
  if (!settings.desktopLyricsEnabled) {
    console.log("桌面歌词未启用，跳过同步数据");
    return;
  }
  
  try {
    if (store.playSongData) {
      // 创建纯数据结构以避免克隆问题
      let artistsText = "";
      try {
        // 安全获取艺术家列表文本
        if (Array.isArray(store.playSongData.artists)) {
          artistsText = store.playSongData.artists
            .map(a => a?.name || "")
            .filter(Boolean)
            .join(", ");
        } else {
          artistsText = String(store.playSongData.artists || "");
        }
      } catch (e) {
        artistsText = "";
      }
      
      const songInfo = {
        name: String(store.playSongData.name || ""),
        artists: artistsText,
        album: String(store.playSongData.album?.name || ""),
        cover: store.playSongData.cover || ""
      };
      
      window.electron.ipcRenderer.send("desktop-lyrics-update-song-info", songInfo);
    }
  } catch (error) {
    console.error("准备歌曲信息时出错:", error);
  }
};

/**
 * 同步设置到桌面歌词窗口
 * 在设置变更时调用
 */
export const syncSettingsToDesktopLyrics = () => {
  if (typeof window.electron === "undefined") return;
  
  const settings = siteSettings();
  
  // 检查桌面歌词是否启用
  if (!settings.desktopLyricsEnabled) {
    console.log("桌面歌词未启用，跳过设置同步");
    return;
  }
  
  // 只同步桌面歌词相关的设置
  const lyricsSettings = {
    // 基本设置
    desktopLyricsShowTitle: settings.desktopLyricsShowTitle,
    desktopLyricsShowArtist: settings.desktopLyricsShowArtist,
    desktopLyricsFontSize: settings.desktopLyricsFontSize,
    desktopLyricsAlignment: settings.desktopLyricsAlignment,
    desktopLyricsScrollPosition: settings.desktopLyricsScrollPosition,
    desktopLyricsHoverPause: settings.desktopLyricsHoverPause,
    desktopLyricsClickJump: settings.desktopLyricsClickJump,
    desktopLyricsOpacity: settings.desktopLyricsOpacity,
    desktopLyricsHoverOpacity: settings.desktopLyricsHoverOpacity,
    desktopLyricsRightClickToggleLock: settings.desktopLyricsRightClickToggleLock,
    
    // 歌词公共设置
    showTransl: settings.showTransl,
    showRoma: settings.showRoma,
    showYrc: settings.showYrc,
  };
  
  console.log("同步设置到桌面歌词窗口");
  console.log("桌面歌词滚动位置设置值:", lyricsSettings.desktopLyricsScrollPosition);
  window.electron.ipcRenderer.send("desktop-lyrics-update-settings", lyricsSettings);
};

/**
 * 初始化桌面歌词控制监听
 * 在App挂载时调用
 */
export const initDesktopLyricsControls = () => {
  if (typeof window.electron === "undefined") return;

  // 移除可能的重复监听器
  window.electron.ipcRenderer.removeAllListeners("desktop-lyrics-control");
  window.electron.ipcRenderer.removeAllListeners("desktop-lyrics-closed");
  
  // 添加新的监听器 - 处理来自桌面歌词窗口的控制命令
  window.electron.ipcRenderer.on("desktop-lyrics-control", (_, data) => {
    console.log("收到桌面歌词控制命令:", data);
    handleDesktopLyricsControl(data);
  });
  
  // 监听桌面歌词窗口关闭事件
  window.electron.ipcRenderer.on("desktop-lyrics-closed", () => {
    // 导入settings store
    const settings = siteSettings();
    
    // 检查是否是用户手动关闭窗口
    // 如果是通过toggleDesktopLyrics关闭的，状态已经更新，不需要再次更新
    if (settings.desktopLyricsEnabled && !settings._isTogglingLyrics) {
      console.log("桌面歌词窗口被用户关闭，更新状态");
      
      // 直接设置状态，避免触发IPC消息
      settings.desktopLyricsEnabled = false;
      
      // 显示提示消息
      $message.info("桌面歌词已关闭", { showIcon: false });
    } else if (settings._isTogglingLyrics) {
      console.log("桌面歌词窗口关闭事件来自toggleDesktopLyrics，忽略");
    }
    
    // 无论如何，确保锁定状态被清理
    settings._isTogglingLyrics = false;
  });
  
  // 监听桌面歌词窗口显示事件
  window.electron.ipcRenderer.on("desktop-lyrics-shown", () => {
    console.log("收到桌面歌词窗口显示事件，立即同步数据");
    // 立即同步所有数据
    syncAllToDesktopLyrics();
    
    // 额外确保歌词数据同步，解决首次打开不滚动的问题
    setTimeout(() => {
      try {
        syncLyricDataToDesktopLyrics();
        syncSongInfoToDesktopLyrics();
        syncPlayStateToDesktopLyrics();
        console.log("桌面歌词窗口显示后，额外同步完成");
      } catch (e) {
        console.warn("桌面歌词额外同步失败:", e);
      }
    }, 200);
    
    // 再次确保歌词数据同步，解决首次打开不显示歌词的问题
    setTimeout(() => {
      try {
        const store = musicData();
        const status = siteStatus();
        
        console.log("二次同步检查:", {
          hasLyric: !!store.playSongLyric,
          lyricLength: store.playSongLyric?.lrc?.length || 0,
          currentIndex: status.playSongLyricIndex,
          playStatus: status.playStatus
        });
        
        if (store.playSongLyric?.lrc?.length > 0) {
          syncLyricDataToDesktopLyrics();
          syncPlayStateToDesktopLyrics();
          console.log("二次同步歌词数据完成");
        }
      } catch (error) {
        console.error("二次同步失败:", error);
      }
    }, 500);
  });

  // 延迟一点再同步状态，确保主进程和渲染进程都已经准备就绪
  setTimeout(() => {
    const settings = siteSettings();
    // 只有当桌面歌词已启用时才同步数据
    if (settings.desktopLyricsEnabled) {
      console.log("初次同步状态到桌面歌词");
      syncAllToDesktopLyrics();
    } else {
      console.log("桌面歌词未启用，跳过初始同步");
    }
  }, 1000);

  // 监听桌面歌词窗口的设置同步请求
  window.electron.ipcRenderer.on("desktop-lyrics-sync-settings-request", () => {
    console.log("收到桌面歌词设置同步请求，立即同步设置");
    try {
      syncSettingsToDesktopLyrics();
    } catch (e) {
      console.error("同步设置失败:", e);
    }
  });
  
  // 监听桌面歌词窗口的歌曲信息同步请求
  window.electron.ipcRenderer.on("desktop-lyrics-sync-song-info-request", () => {
    console.log("收到桌面歌词歌曲信息同步请求，立即同步歌曲信息");
    try {
      syncSongInfoToDesktopLyrics();
    } catch (e) {
      console.error("同步歌曲信息失败:", e);
    }
  });

  console.log("桌面歌词控制监听已初始化");
};

/**
 * 同步所有状态到桌面歌词窗口
 * 用于初始化或重新连接
 */
export const syncAllToDesktopLyrics = () => {
  try {
    const settings = siteSettings();
    
    // 只有当桌面歌词已启用时才同步数据
    // 这可以防止初始化时错误地触发状态切换
    if (settings.desktopLyricsEnabled) {
      console.log("同步所有数据到桌面歌词窗口");
      
      // 同步所有数据到桌面歌词
      syncSettingsToDesktopLyrics();
      syncSongInfoToDesktopLyrics();
      syncLyricDataToDesktopLyrics();
      syncPlayStateToDesktopLyrics();
    } else {
      console.log("桌面歌词未启用，跳过数据同步");
    }
  } catch (error) {
    console.warn("同步数据到桌面歌词时出错:", error);
  }
};