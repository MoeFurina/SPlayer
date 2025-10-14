/**
 * 桌面歌词专用Store
 * 用于桌面歌词窗口的状态管理，与主窗口Store独立
 */
import { defineStore } from "pinia";

export const useDesktopLyricsStore = defineStore("desktopLyrics", {
  state: () => ({
    // 歌词数据
    lyricsData: [],
    // 当前歌词索引
    currentLyricIndex: 0,
    // 当前歌曲信息
    currentSong: {
      name: "",
      artists: "",
      album: "",
      cover: ""
    },
    // 歌词能力
    hasYrc: false,
    hasLrcTran: false,
    hasLrcRoma: false,
    // 播放状态
    isPlaying: false,
    playSeek: 0,
    // 界面设置
    settings: {
      // 显示设置
      showYrc: false,
      showTransl: true,
      showRoma: true,
      showSongInfo: true,
      showArtist: true,
      // 样式设置
      fontSize: 36,
      alignment: "center", // left/center/right
      scrollPosition: "center", // top/center
      // 交互设置
      enableHoverPause: true,
      enableClickJump: true,
      windowOpacity: 0.9,
      hoverOpacity: 0.95,
      // 窗口设置
      isLocked: false,
    }
  }),
  actions: {
    // 更新歌词数据
    updateLyricData(data) {
      this.lyricsData = data.lrc || [];
      this.hasYrc = data.hasYrc || false;
      this.hasLrcTran = data.hasLrcTran || false;
      this.hasLrcRoma = data.hasLrcRoma || false;
    },
    
    // 更新播放状态
    updatePlayState(data) {
      this.isPlaying = data.isPlaying || false;
      this.playSeek = data.playSeek || 0;
      this.currentLyricIndex = data.lyricIndex || 0;
    },
    
    // 更新歌曲信息
    updateSongInfo(data) {
      this.currentSong = data;
    },
    
    // 更新设置
    updateSettings(settings) {
      this.settings = {
        ...this.settings,
        ...settings
      };
    }
  },
  // 持久化到localStorage
  persist: {
    enabled: true,
    strategies: [
      {
        key: "desktop-lyrics-store",
        storage: localStorage,
      },
    ],
  },
});

export default useDesktopLyricsStore;



