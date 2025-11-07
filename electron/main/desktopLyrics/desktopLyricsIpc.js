// 桌面歌词 IPC 事件统一注册
// 负责主窗口与桌面歌词窗口之间的所有 IPC 通信

import { screen } from "electron";

/**
 * 注册所有桌面歌词相关的 IPC 事件
 * @param {Electron.IpcMain} ipcMain IPC 主进程对象
 * @param {DesktopLyricsManager} manager 桌面歌词管理器
 * @param {Electron.BrowserWindow} mainWindow 主窗口
 * @param {Store} store electron-store 实例
 */
export const registerDesktopLyricsIpc = (ipcMain, manager, mainWindow, store) => {
  // 辅助函数：检查桌面歌词窗口是否有效
  const isDesktopLyricsWindowValid = () => {
    return manager.window && !manager.window.isDestroyed();
  };

  // 辅助函数：检查主窗口是否有效
  const isMainWindowValid = () => {
    return mainWindow && !mainWindow.isDestroyed();
  };

  // 辅助函数：向桌面歌词窗口发送消息
  const sendToDesktopLyrics = (channel, data) => {
    if (isDesktopLyricsWindowValid()) {
      manager.window.webContents.send(channel, data);
    }
  };

  // 辅助函数：向主窗口发送消息
  const sendToMainWindow = (channel, data) => {
    if (isMainWindowValid()) {
      mainWindow.webContents.send(channel, data);
    }
  };

  // 辅助函数：通知锁定状态变化
  const notifyLockStateChanged = (isLocked) => {
    sendToDesktopLyrics("desktop-lyrics-lock-changed", isLocked);
    sendToMainWindow("desktop-lyrics-lock-changed", isLocked);
  };

  // 窗口控制命令
  ipcMain.on("desktop-lyrics-show", () => {
    manager.show();
  });

  ipcMain.on("desktop-lyrics-hide", () => {
    manager.hide();
  });

  ipcMain.on("desktop-lyrics-toggle", () => {
    manager.toggle();
  });

  ipcMain.on("desktop-lyrics-set-always-on-top", (_, flag) => {
    manager.setAlwaysOnTop(flag);
  });

  // 焦点管理：处理鼠标移出桌面歌词窗口
  ipcMain.on("desktop-lyrics-mouse-leave", () => {
    manager.handleMouseLeave();
  });

  // 数据同步（主窗口 → 桌面歌词窗口）
  const createDataForwarder = (receiveChannel, sendChannel) => {
    ipcMain.on(receiveChannel, (_, data) => {
      sendToDesktopLyrics(sendChannel, data);
    });
  };

  // 注册数据转发器
  const dataForwarders = [
    ["desktop-lyrics-update-play-state", "play-state-updated"],
    ["desktop-lyrics-update-lyric-data", "lyric-data-updated"],
    ["desktop-lyrics-update-song-info", "song-info-updated"],
    ["desktop-lyrics-update-settings", "settings-updated"],
  ];
  dataForwarders.forEach(([receive, send]) => createDataForwarder(receive, send));

  // 同步请求（桌面歌词窗口 → 主窗口）
  const createSyncRequest = (receiveChannel, sendChannel) => {
    ipcMain.on(receiveChannel, () => {
      sendToMainWindow(sendChannel);
    });
  };

  // 注册同步请求
  const syncRequests = [
    ["desktop-lyrics-sync-settings", "desktop-lyrics-sync-settings-request"],
    ["desktop-lyrics-sync-song-info", "desktop-lyrics-sync-song-info-request"],
    ["desktop-lyrics-sync-lyric-data", "desktop-lyrics-sync-lyric-data-request"],
    ["desktop-lyrics-sync-play-state", "desktop-lyrics-request-play-state"],
  ];
  syncRequests.forEach(([receive, send]) => createSyncRequest(receive, send));

  // 播放控制（桌面歌词窗口 → 主窗口）
  ipcMain.on("desktop-lyrics-control", (_, action) => {
    // 间距调节指令直接发送回桌面歌词窗口
    if (action.action === "lineSpacing" || action.action === "letterSpacing") {
      sendToDesktopLyrics("desktop-lyrics-control", action);
      return;
    }

    // 其他控制指令转发给主窗口
    sendToMainWindow("desktop-lyrics-control", action);
  });

  // 窗口操作
  ipcMain.on("desktop-lyrics-window-move", (_, { deltaX, deltaY }) => {
    if (!isDesktopLyricsWindowValid()) return;

    const bounds = manager.window.getBounds();

    let logicalDeltaX = deltaX;
    let logicalDeltaY = deltaY;

    // 仅在 Windows 上修复 DPI 缩放问题
    // macOS 的 screenX/Y 已经是逻辑像素，不需要转换
    if (process.platform === "win32") {
      const display = screen.getDisplayNearestPoint({ x: bounds.x, y: bounds.y });
      const scaleFactor = display.scaleFactor || 1;

      // Windows 的 screenX/Y 返回物理像素，需要转换为逻辑像素
      logicalDeltaX = Math.round(deltaX / scaleFactor);
      logicalDeltaY = Math.round(deltaY / scaleFactor);
    }

    manager.window.setBounds({
      x: bounds.x + logicalDeltaX,
      y: bounds.y + logicalDeltaY,
      width: bounds.width,
      height: bounds.height,
    });
  });

  ipcMain.on("desktop-lyrics-window-resize", (_, { height, direction }) => {
    if (!isDesktopLyricsWindowValid()) return;

    const bounds = manager.window.getBounds();
    const newBounds = { ...bounds, height };

    // 从顶部调整时需要同时调整Y坐标
    if (direction === "top") {
      newBounds.y = bounds.y + (bounds.height - height);
    }

    manager.window.setBounds(newBounds);
  });

  // 锁定状态管理
  const applyLockState = (isLocked) => {
    if (!isDesktopLyricsWindowValid()) return;

    try {
      if (isLocked) {
        manager.window.setIgnoreMouseEvents(true, { forward: true });
        manager.window.setFocusable(false);
        try {
          manager.window.setOpacity(1.0);
        } catch (_) {}
      } else {
        manager.window.setIgnoreMouseEvents(false);
        manager.window.setFocusable(true);
        try {
          manager.window.focus();
        } catch (_) {}
      }
    } catch (e) {
      console.warn("设置桌面歌词窗口穿透失败", e);
    }
  };

  ipcMain.on("desktop-lyrics-set-locked", (_, isLocked) => {
    store.set("desktopLyricsWindowConfig.isLocked", isLocked);
    notifyLockStateChanged(isLocked);
    applyLockState(isLocked);
  });

  ipcMain.on("desktop-lyrics-toggle-lock", () => {
    if (!isDesktopLyricsWindowValid()) return;

    const currentLocked = store.get("desktopLyricsWindowConfig.isLocked", false);
    const newLocked = !currentLocked;

    store.set("desktopLyricsWindowConfig.isLocked", newLocked);
    notifyLockStateChanged(newLocked);
    applyLockState(newLocked);
  });

  // 状态查询
  ipcMain.handle("desktop-lyrics-get-state", () => {
    if (!isDesktopLyricsWindowValid()) return null;

    return {
      isVisible: manager.window.isVisible(),
      bounds: manager.window.getBounds(),
      alwaysOnTop: manager.window.isAlwaysOnTop(),
    };
  });

  // 获取锁定状态
  ipcMain.handle("desktop-lyrics-get-lock-status", () => {
    return store.get("desktopLyricsWindowConfig.isLocked", false);
  });

  // 设置保存
  ipcMain.on("desktop-lyrics-save-setting", (_, { key, value }) => {
    sendToMainWindow("update-desktop-lyrics-setting", { key, value });
  });

  // 系统配置重置
  ipcMain.on("reset-all-config", () => {
    try {
      store.clear();
    } catch (error) {
      console.error("清除electron-store失败:", error);
    }
  });
};

