/**
 * 桌面歌词数据同步和控制指令处理
 */
import { musicData, siteSettings, siteStatus } from "@/stores";
import { changePlayIndex, fadePlayOrPause, setSeek, isPlaying } from "@/utils/Player";

// 防止重复调用的锁
let _isTogglingLyrics = false;

// 获取消息实例的函数（延迟获取，确保LightProvider已初始化）
const getMessage = () => {
  return window.$message || {
    info: (msg) => console.log(`[消息]: ${msg}`)
  };
};

// 安全同步设置
const safeSyncSettings = () => {
  try { syncSettingsToDesktopLyrics(); } catch (e) {}
};

// 安全同步播放状态
const safeSyncPlayState = () => {
  try { syncPlayStateToDesktopLyrics(); } catch (e) {}
};

// 数值范围限制
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

// 字号范围配置
const FONT_SIZE_RANGE = {
  min: 5,
  max: 55
};

/**
 * 创建字号处理器
 * @param {string} settingKey - 设置键名
 * @returns {Function} 处理器函数
 */
const createFontSizeHandler = (settingKey) => () => {
  if (typeof value === "number") {
    settings[settingKey] = clamp(value, FONT_SIZE_RANGE.min, FONT_SIZE_RANGE.max);
    safeSyncSettings();
  }
};

// 监听桌面歌词请求播放状态
if (typeof window.electron !== "undefined") {
  window.electron.ipcRenderer.on("desktop-lyrics-request-play-state", () => {
    syncPlayStateToDesktopLyrics();
  });
}

/**
 * 处理桌面歌词发来的控制指令
 * @param {Object} data 控制数据对象
 */
export const handleDesktopLyricsControl = ({ action, value }) => {
  const settings = siteSettings();

  // 播放控制处理器
  const playControlHandlers = {
    playPause: () => {
      const status = siteStatus();
      fadePlayOrPause(status.playState ? "pause" : "play");
      setTimeout(safeSyncPlayState, 80);
    },
    prev: () => changePlayIndex("prev"),
    next: () => changePlayIndex("next"),
    seek: () => {
      if (typeof value === "number") {
        setSeek(value);
        // 立即同步播放状态，确保逐字歌词实时更新
        setTimeout(safeSyncPlayState, 80);
      }
    },
  };

  // 设置控制处理器
  const settingHandlers = {
    fontSize: () => {
      if (typeof value === "number") {
        settings.desktopLyricsFontSize = value;
        safeSyncSettings();
      }
    },
    tranFontSize: createFontSizeHandler('desktopLyricsTranFontSize'),
    romaFontSize: createFontSizeHandler('desktopLyricsRomaFontSize'),
    toggleYrc: () => {
      settings.showYrc = !settings.showYrc;
      safeSyncSettings();
    },
    windowOpacity: () => {
      if (typeof value === "number") {
        settings.desktopLyricsOpacity = clamp(value, 0.1, 1);
        safeSyncSettings();
      }
    },
    windowBackgroundOpacity: () => {
      if (typeof value === "number") {
        settings.desktopLyricsWindowOpacity = clamp(value, 0, 1);
        safeSyncSettings();
      }
    },
    hoverOpacity: () => {
      if (typeof value === "number") {
        settings.desktopLyricsHoverOpacity = clamp(value, 0.1, 1);
        safeSyncSettings();
      }
    },
    toggleAutoLock: () => {
      settings.desktopLyricsAutoLock = !settings.desktopLyricsAutoLock;
      safeSyncSettings();
    },
  };

  // 执行对应的处理器
  const handler = playControlHandlers[action] || settingHandlers[action];
  if (handler) {
    handler();
  } else {
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
  
  if (!settings.desktopLyricsEnabled) {
    return;
  }
  
  const isActuallyPlaying = isPlaying();
  
  window.electron.ipcRenderer.send("desktop-lyrics-update-play-state", {
    isPlaying: isActuallyPlaying,
    seek: status.playSeek,
    lyricIndex: status.playSongLyricIndex,
    timestamp: Date.now()
  });
};

// 简化歌词行数据（统一转换为伪逐字格式）
const simplifyLyricLine = (item) => {
  const content = item.content || "";

  // 统一转换：所有常规歌词都转换为伪逐字格式
  if (content.trim()) {
    const isEnglish = detectLanguage(content) === 'english';

    // 英文：按单词拆分；中文：按字符拆分
    const tokens = isEnglish
      ? (content.match(/[\w']+|[^\w\s']/g) || [])
      : content.split('');

    const pseudoYrcItem = {
      time: item.time || 0,
      endTime: item.time || 0,
      content: tokens.map(token => ({ time: 0, duration: 0, content: token })),
      tran: item.tran || "",
      roma: item.roma || "",
    };

    return { ...simplifyYrcLine(pseudoYrcItem), isRegularLyric: true, isEnglish };
  }

  // 空歌词
  return {
    time: item.time || 0,
    content: [],
    tran: item.tran || "",
    roma: item.roma || "",
    isEnglish: false,
    isRegularLyric: true,
  };
};

// 检测文本语言（中文/英文）
const detectLanguage = (text) => {
  if (!text) return 'unknown';

  // 使用 test 方法提前判断，避免不必要的匹配
  const hasChinese = /[\u4e00-\u9fff]/.test(text);
  const hasEnglish = /[a-zA-Z]/.test(text);

  // 只有一种语言时直接返回
  if (hasChinese && !hasEnglish) return 'chinese';
  if (hasEnglish && !hasChinese) return 'english';

  // 混合语言时才进行计数比较
  if (hasChinese && hasEnglish) {
    const chineseCharCount = (text.match(/[\u4e00-\u9fff]/g) || []).length;
    const englishCharCount = (text.match(/[a-zA-Z]/g) || []).length;
    return chineseCharCount > englishCharCount ? 'chinese' : 'english';
  }

  return 'unknown';
};

// 简化逐字歌词单词数据
const simplifyYrcWord = (word) => {
  // 清理零宽字符和空格
  const cleanedContent = (word.content || "")
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .trim();

  return {
    time: word.time || 0,
    duration: word.duration || 0,
    content: cleanedContent,
  };
};

// 简化逐字歌词行数据（兼容 parseLyric.js 和 lyric.ts 两种数据源）
const simplifyYrcLine = (item) => {
  const words = Array.isArray(item.contents) ? item.contents :
                (Array.isArray(item.content) ? item.content : []);

  // 检测语言
  const fullText = words.map(w => w.content || '').join('');
  const isEnglish = detectLanguage(fullText) === 'english';

  return {
    time: item.time || 0,
    endTime: item.endTime || 0,
    content: words.map(simplifyYrcWord),
    tran: item.tran || "",
    roma: item.roma || "",
    isEnglish,
  };
};

/**
 * 同步歌词数据到桌面歌词窗口
 * 在歌曲切换或歌词加载完成时调用
 */
export const syncLyricDataToDesktopLyrics = () => {
  if (typeof window.electron === "undefined") return;

  const settings = siteSettings();
  const store = musicData();

  if (!settings.desktopLyricsEnabled) return;

  try {
    const lyric = store.playSongLyric || {};
    const processedYrc = (lyric.yrc || []).map((item, index) => simplifyYrcLine(item, index));

    window.electron.ipcRenderer.send("desktop-lyrics-update-lyric-data", {
      lrc: (lyric.lrc || []).map(simplifyLyricLine),
      yrc: processedYrc,
      hasYrc: !!lyric.hasYrc,
      hasLrcTran: !!lyric.hasLrcTran,
      hasLrcRoma: !!lyric.hasLrcRoma,
    });
  } catch (error) {
    console.error("准备歌词数据时出错:", error);
  }
};

// 安全获取艺术家文本
const getArtistsText = (artists) => {
  try {
    if (Array.isArray(artists)) {
      return artists.map(a => a?.name || "").filter(Boolean).join(", ");
    }
    return String(artists || "");
  } catch (e) {
    return "";
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

  if (!settings.desktopLyricsEnabled) return;

  try {
    const songData = store.getPlaySongData;
    if (!songData) return;

    window.electron.ipcRenderer.send("desktop-lyrics-update-song-info", {
      name: String(songData.name || ""),
      artists: getArtistsText(songData.artists),
      album: String(songData.album?.name || ""),
      cover: songData.cover || "",
    });
  } catch (error) {
    console.error("准备歌曲信息时出错:", error);
  }
};

/**
 * 切换桌面歌词开关
 * 替代原 siteSettings.toggleDesktopLyrics()
 */
export const toggleDesktopLyrics = () => {
  if (_isTogglingLyrics) return;

  _isTogglingLyrics = true;
  const settings = siteSettings();

  try {
    const newState = !settings.desktopLyricsEnabled;
    settings.desktopLyricsEnabled = newState;

    if (typeof window.electron !== "undefined") {
      const command = newState ? "desktop-lyrics-show" : "desktop-lyrics-hide";
      window.electron.ipcRenderer.send(command);

      if (newState) {
        // 增加延时，确保桌面歌词窗口完全初始化
        setTimeout(() => {
          syncSettingsToDesktopLyrics();
          syncAllToDesktopLyrics();
        }, 500);
      }

      getMessage().info(
        newState ? "桌面歌词已开启" : "桌面歌词已关闭",
        { showIcon: false }
      );
    }

    setTimeout(() => {
      _isTogglingLyrics = false;
    }, 500);
  } catch (error) {
    console.error("桌面歌词切换出错:", error);
    _isTogglingLyrics = false;
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
    return;
  }

  // 只同步桌面歌词相关的设置
  const lyricsSettings = {
    desktopLyricsShowTitle: settings.desktopLyricsShowTitle,
    desktopLyricsShowArtist: settings.desktopLyricsShowArtist,
    desktopLyricsFontSize: settings.desktopLyricsFontSize,
    desktopLyricsTitleFontSize: settings.desktopLyricsTitleFontSize,
    desktopLyricsTranFontSize: settings.desktopLyricsTranFontSize,
    desktopLyricsRomaFontSize: settings.desktopLyricsRomaFontSize,
    desktopLyricsAlignment: settings.desktopLyricsAlignment,
    desktopLyricsScrollPosition: settings.desktopLyricsScrollPosition,
    desktopLyricsHoverPause: settings.desktopLyricsHoverPause,
    desktopLyricsClickJump: settings.desktopLyricsClickJump,
    desktopLyricsOpacity: settings.desktopLyricsOpacity,
    desktopLyricsHoverOpacity: settings.desktopLyricsHoverOpacity,
    desktopLyricsWindowOpacity: settings.desktopLyricsWindowOpacity,
    desktopLyricsRightClickToggleLock: settings.desktopLyricsRightClickToggleLock,
    desktopLyricsAutoLock: settings.desktopLyricsAutoLock,
    desktopLyricsLineSpacing: settings.desktopLyricsLineSpacing,
    desktopLyricsLetterSpacing: settings.desktopLyricsLetterSpacing,
    showTransl: settings.showTransl,
    showRoma: settings.showRoma,
    showYrc: settings.showYrc,
  };

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

  // 处理来自桌面歌词窗口的控制命令
  window.electron.ipcRenderer.on("desktop-lyrics-control", (_, data) => {
    handleDesktopLyricsControl(data);
  });

  // 监听桌面歌词窗口关闭事件
  window.electron.ipcRenderer.on("desktop-lyrics-closed", () => {
    const settings = siteSettings();

    // 检查是否是用户手动关闭窗口
    if (settings.desktopLyricsEnabled && !_isTogglingLyrics) {
      settings.desktopLyricsEnabled = false;
      getMessage().info("桌面歌词已关闭", { showIcon: false });
    }

    // 确保锁定状态被清理
    _isTogglingLyrics = false;
  });

  // 监听桌面歌词窗口显示事件
  window.electron.ipcRenderer.on("desktop-lyrics-shown", () => {
    // 立即同步所有数据
    syncAllToDesktopLyrics();

    // 延迟再次同步，确保数据完整
    setTimeout(() => {
      syncAllToDesktopLyrics();
    }, 1000);
  });

  // 延迟同步状态，确保主进程和渲染进程都已经准备就绪
  setTimeout(() => {
    const settings = siteSettings();
    if (settings.desktopLyricsEnabled) {
      syncAllToDesktopLyrics();
    }
  }, 1000);

  // 创建同步请求处理器
  const createSyncHandler = (eventName, syncFunction, errorContext) => {
    window.electron.ipcRenderer.on(eventName, () => {
      try {
        syncFunction();
      } catch (e) {
        console.error(`${errorContext}失败:`, e);
      }
    });
  };

  // 注册同步请求处理器
  createSyncHandler("desktop-lyrics-sync-settings-request", syncSettingsToDesktopLyrics, "同步设置");
  createSyncHandler("desktop-lyrics-sync-song-info-request", syncSongInfoToDesktopLyrics, "同步歌曲信息");
  createSyncHandler("desktop-lyrics-sync-lyric-data-request", syncLyricDataToDesktopLyrics, "同步歌词数据");

  // 监听来自桌面歌词窗口的设置更新
  window.electron.ipcRenderer.on("update-desktop-lyrics-setting", (_, { key, value }) => {
    const settings = siteSettings();

    if (key && settings[key] !== undefined) {
      settings[key] = value;
    } else {
      console.warn(`未知的设置项: ${key}`);
    }
  });
};

/**
 * 同步所有状态到桌面歌词窗口
 * 用于初始化或重新连接
 */
export const syncAllToDesktopLyrics = () => {
  const settings = siteSettings();

  if (!settings.desktopLyricsEnabled) {
    return;
  }

  try {
    // 同步所有数据到桌面歌词
    syncSettingsToDesktopLyrics();
    syncSongInfoToDesktopLyrics();
    syncLyricDataToDesktopLyrics();
    syncPlayStateToDesktopLyrics();
  } catch (error) {
    console.warn("同步数据到桌面歌词时出错:", error);
  }
};


/**
 * 强制清除桌面歌词启用状态（用于错误处理）
 * 替代原 siteSettings.forceClearDesktopLyricsEnabled()
 */
export const forceClearDesktopLyricsEnabled = () => {
  const settings = siteSettings();
  settings.desktopLyricsEnabled = false;
  _isTogglingLyrics = false;
};