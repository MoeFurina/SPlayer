import { join } from "path";
import { BrowserWindow, screen } from "electron";
import { is } from "@electron-toolkit/utils";
import fs from "fs";

// 桌面歌词窗口管理器
// 负责桌面歌词窗口的创建、显示、隐藏和配置管理
export class DesktopLyricsManager {
  constructor(getMainWindow, store, isMainWindowTrulyVisible) {
    this.getMainWindow = getMainWindow; // 使用函数避免初始化顺序问题
    this.store = store;
    this.isMainWindowTrulyVisible = isMainWindowTrulyVisible; // 检查主窗口是否真正可见
    this.window = null;
    this._isManualHiding = false;
    this._mainWindowShowHandler = null;
  }

  // 辅助函数：检查桌面歌词窗口是否有效
  _isWindowValid() {
    return this.window && !this.window.isDestroyed();
  }

  // 辅助函数：获取有效的主窗口
  _getValidMainWindow() {
    const mainWindow = this.getMainWindow();
    return mainWindow && !mainWindow.isDestroyed() ? mainWindow : null;
  }

  // 辅助函数：保存窗口配置
  _saveWindowConfig(key, value) {
    this.store.set(`desktopLyricsWindowConfig.${key}`, value);
  }

  // 辅助函数：处理错误并通知主窗口
  _handleError(context, error) {
    console.error(`${context}:`, error);
    this._notifyMainWindow("desktop-lyrics-error", {
      message: context,
      error: error.toString(),
    });
  }

  // 设置主窗口事件监听
  setupMainWindowListeners() {
    const mainWindow = this._getValidMainWindow();
    if (!mainWindow) return;

    // 监听主窗口 show 事件，实现桌面歌词相关的焦点管理
    this._mainWindowShowHandler = () => {
      // 延迟执行确保窗口完全显示
      setTimeout(() => {
        if (this.isVisible()) {
          this._focusMainWindow();
        }
      }, 100);
    };

    mainWindow.on("show", this._mainWindowShowHandler);
  }

  // 创建桌面歌词窗口
  create() {
    try {
      // 如果窗口已存在且未销毁，直接显示
      if (this._isWindowValid()) {
        this.window.show();
        return;
      }

      // 如果存在但已销毁，清空引用
      if (this.window && this.window.isDestroyed()) {
        this.window = null;
      }

      // 获取并验证窗口配置
      const config = this._getValidConfig();

      // 创建窗口
      this.window = new BrowserWindow({
        title: "SPlayer - 桌面歌词",
        width: config.width,
        height: config.height,
        x: config.x,
        y: config.y,
        minWidth: 400,
        minHeight: 34,
        frame: false,
        transparent: true,
        opacity: 0.95,
        resizable: true,
        alwaysOnTop: true,
        skipTaskbar: true,
        show: false,
        hasShadow: false,
        backgroundColor: "#00000000",
        webPreferences: {
          preload: join(__dirname, "../preload/index.mjs"),
          sandbox: false,
          webSecurity: false,
          nodeIntegration: true,
          contextIsolation: false,
          backgroundThrottling: false,
        },
      });

      this._setupWindowEvents();
      this.window.once("ready-to-show", () => {
        this._handleReadyToShow();
      });
      this._loadContent();

      // 开发模式下自动打开开发者工具
      // if (is.dev) {
      //   this.window.webContents.openDevTools({ mode: "detach" });
      // }

      this.window.webContents.on("did-fail-load", (_, errorCode, errorDescription) => {
        console.error("桌面歌词页面加载失败:", errorCode, errorDescription);
        this._notifyMainWindow("desktop-lyrics-error", {
          message: `桌面歌词页面加载失败: ${errorDescription}`,
          errorCode,
        });
      });
    } catch (error) {
      this._handleError("创建桌面歌词窗口时发生错误", error);
    }
  }

  // 显示桌面歌词窗口
  show() {
    try {
      if (!this._isWindowValid()) {
        this.create();
        return;
      }

      if (!this.window.isVisible()) {
        this._ensureWindowInScreen();

        if (this.window.webContents.getURL() === "") {
          this._loadContent();
        }

        this.window.show();
        this._notifyMainWindow("desktop-lyrics-shown");
      }
    } catch (error) {
      this._handleError("显示桌面歌词窗口时发生异常", error);
    }
  }

  // 隐藏桌面歌词窗口
  hide() {
    if (this._isWindowValid()) {
      this._isManualHiding = true;
      this.window.hide();

      this._notifyMainWindow("desktop-lyrics-closed");

      setTimeout(() => {
        this._isManualHiding = false;
      }, 100);
    }
  }

  // 切换桌面歌词窗口显示状态
  toggle() {
    if (this.isVisible()) {
      this.hide();
    } else {
      this.show();
    }
  }

  // 检查窗口是否可见
  isVisible() {
    return this._isWindowValid() && this.window.isVisible();
  }

  // 设置总是置顶
  setAlwaysOnTop(flag) {
    if (this._isWindowValid()) {
      this.window.setAlwaysOnTop(flag);
      this._saveWindowConfig("alwaysOnTop", flag);
    }
  }

  // 获取并验证窗口配置
  _getValidConfig() {
    const config = this.store.get("desktopLyricsWindowConfig") || {};
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;

    const validConfig = {
      width: config.width || 580,
      height: config.height || 180,
      x: config.x >= 0 && config.x < screenWidth ? config.x : undefined,
      y: config.y >= 0 && config.y < screenHeight ? config.y : undefined,
      alwaysOnTop: !!config.alwaysOnTop,
    };

    // 如果位置无效，设置默认位置
    if (validConfig.x === undefined || validConfig.y === undefined) {
      validConfig.x = Math.floor((screenWidth - validConfig.width) / 2);
      validConfig.y = Math.floor(screenHeight * 0.2);
    }

    return validConfig;
  }

  // 绑定窗口事件
  _setupWindowEvents() {
    // 保存窗口位置
    this.window.on("move", () => {
      if (!this._isWindowValid()) return;
      const { x, y } = this.window.getBounds();
      this._saveWindowConfig("x", x);
      this._saveWindowConfig("y", y);
    });

    // 保存窗口大小
    this.window.on("resize", () => {
      if (!this._isWindowValid()) return;
      const { width, height } = this.window.getBounds();
      this._saveWindowConfig("width", width);
      this._saveWindowConfig("height", height);
    });

    // 阻止窗口关闭，改为隐藏
    this.window.on("close", (event) => {
      if (!this._isManualHiding) {
        event.preventDefault();
        this.window.hide();
        this._notifyMainWindow("desktop-lyrics-closed");
      }
    });

    // 窗口销毁时清理
    this.window.on("closed", () => {
      setTimeout(() => {
        this._notifyMainWindow("desktop-lyrics-closed");
        this.window = null;
      }, 100);
    });
  }

  // 处理窗口准备就绪
  _handleReadyToShow() {
    try {
      this.window.setAlwaysOnTop(true);

      const url = this.window.webContents.getURL();
      if (!url || url === "") {
        console.warn("桌面歌词窗口内容未加载，尝试重新加载");
        this._loadContent();

        setTimeout(() => {
          this.window.show();
          this.window.focus();
          this._notifyMainWindow("desktop-lyrics-shown");
        }, 500);
      } else {
        this.window.setVisibleOnAllWorkspaces(true);
        this.window.setAlwaysOnTop(true, "floating");
        this.window.show();
        this.window.focus();
        this._notifyMainWindow("desktop-lyrics-shown");
      }

      // 延迟恢复用户设置的置顶状态
      setTimeout(() => {
        if (this._isWindowValid()) {
          const shouldBeOnTop = !!this.store.get("desktopLyricsWindowConfig.alwaysOnTop", false);
          this.window.setAlwaysOnTop(shouldBeOnTop);
        }
      }, 2000);
    } catch (error) {
      this._handleError("显示桌面歌词窗口时出错", error);
    }
  }

  // 加载窗口内容
  _loadContent() {
    try {
      if (!this._isWindowValid()) {
        console.error("无法加载内容：窗口对象不存在或已销毁");
        return;
      }

      // 开发模式：加载开发服务器 URL
      if (is.dev && process.env.ELECTRON_RENDERER_URL) {
        const url = `${process.env.ELECTRON_RENDERER_URL}/desktop-lyrics.html`;
        this.window.loadURL(url);
        return;
      }

      // 生产模式：按优先级尝试加载文件
      const filePaths = [
        join(__dirname, "../renderer/desktop-lyrics.html"),
        join(__dirname, "../../desktop-lyrics.html"),
        join(__dirname, "../renderer/index.html"), // 备用方案
      ];

      for (const filePath of filePaths) {
        if (fs.existsSync(filePath)) {
          this.window.loadFile(filePath);
          if (filePath.includes("index.html")) {
            console.warn("桌面歌词文件不存在，加载主页面作为备用");
          }
          return;
        }
      }

      throw new Error("未找到可用的桌面歌词文件");
    } catch (error) {
      this._handleError("加载桌面歌词窗口失败", error);
    }
  }

  // 确保窗口位置在屏幕内
  _ensureWindowInScreen() {
    if (!this._isWindowValid()) return;

    const primaryDisplay = screen.getPrimaryDisplay();
    const { width, height } = primaryDisplay.workAreaSize;
    const bounds = this.window.getBounds();

    if (bounds.x < 0 || bounds.x > width || bounds.y < 0 || bounds.y > height) {
      this.window.center();
    }
  }

  // 将焦点转移到主窗口（通用方法）
  _focusMainWindow() {
    const mainWindow = this._getValidMainWindow();
    if (mainWindow) {
      try {
        mainWindow.focus();
      } catch (error) {
        console.warn("无法将焦点转移到主窗口:", error);
      }
    }
  }

  // 处理鼠标移出桌面歌词窗口
  handleMouseLeave() {
    // 使用 isMainWindowTrulyVisible 检查主窗口是否真正可见（未被手动隐藏）
    // 这样可以避免在主窗口被用户手动隐藏时，调用 focus() 导致窗口被意外唤出
    if (this.isMainWindowTrulyVisible && this.isMainWindowTrulyVisible()) {
      this._focusMainWindow();
    }
  }

  // 通知主窗口
  _notifyMainWindow(channel, data) {
    const mainWindow = this._getValidMainWindow();
    if (mainWindow) {
      mainWindow.webContents.send(channel, data);
    }
  }
}

