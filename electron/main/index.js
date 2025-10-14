import { join } from "path";
import { app, protocol, shell, BrowserWindow, globalShortcut, nativeImage } from "electron";
import { platform, optimizer, is } from "@electron-toolkit/utils";
import { startNcmServer } from "@main/startNcmServer";
import { startMainServer } from "@main/startMainServer";
import createSystemTray from "@main/utils/createSystemTray";
import createGlobalShortcut from "@main/utils/createGlobalShortcut";
import mainIpcMain from "@main/mainIpcMain";
import Store from "electron-store";
import log from "electron-log";

// 屏蔽报错
process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = "true";

// 配置 log
log.transports.file.resolvePathFn = () =>
  join(app.getPath("documents"), "/SPlayer/SPlayer-log.txt");
// 设置日志文件的最大大小为 2 MB
log.transports.file.maxSize = 2 * 1024 * 1024;
// 绑定 console 事件
console.error = log.error.bind(log);
console.warn = log.warn.bind(log);
console.info = log.info.bind(log);
console.debug = log.debug.bind(log);

// 主进程
class MainProcess {
  constructor() {
    // 主窗口
    this.mainWindow = null;
    // 主代理
    this.mainServer = null;
    // 网易云 API
    this.ncmServer = null;
    // 桌面歌词窗口
    this.desktopLyricsWindow = null;
    // Store
    this.store = new Store({
      schema: {
        // 窗口大小
        windowSize: {
          type: "object",
          properties: {
            width: { type: "number", default: 1280 },
            height: { type: "number", default: 740 },
          },
          default: {
            width: 1280,
            height: 740,
          },
        },
        // 桌面歌词窗口配置
        desktopLyricsWindowConfig: {
          type: "object",
          properties: {
            x: { type: "number", default: -1 },        // -1表示未设置（居中）
            y: { type: "number", default: -1 },
            width: { type: "number", default: 800 },
            height: { type: "number", default: 200 },
            isLocked: { type: "boolean", default: false },
            alwaysOnTop: { type: "boolean", default: true },
          },
          default: {
            x: -1,
            y: -1,
            width: 800,
            height: 200,
            isLocked: false,
            alwaysOnTop: true,
          },
        },
      },
    });
    // 设置应用程序名称
    if (process.platform === "win32") app.setAppUserModelId(app.getName());
    // 初始化
    this.checkApp().then(async (lockObtained) => {
      if (lockObtained) {
        await this.init();
      }
    });
  }

  // 单例锁
  async checkApp() {
    if (!app.requestSingleInstanceLock()) {
      log.error("已有一个程序正在运行，本次启动阻止");
      app.quit();
      // 未获得锁
      return false;
    }
    // 聚焦到当前程序
    else {
      app.on("second-instance", () => {
        if (this.mainWindow) {
          this.mainWindow.show();
          if (this.mainWindow.isMinimized()) this.mainWindow.restore();
          this.mainWindow.focus();
        }
      });
      // 获得锁
      return true;
    }
  }

  // 初始化程序
  async init() {
    log.info("主进程初始化");

    // 启动网易云 API
    try {
      this.ncmServer = await startNcmServer({
        port: import.meta.env.MAIN_VITE_SERVER_PORT || 11451,
        host: import.meta.env.MAIN_VITE_SERVER_HOST || "127.0.0.1",
      });
    } catch (error) {
      console.error("启动网易云 API 失败:", error);
    }

    // 非开发环境启动代理
    if (!is.dev) {
      this.mainServer = await startMainServer();
    }

    // 注册应用协议
    app.setAsDefaultProtocolClient("SPlayer");
    // 应用程序准备好之前注册
    protocol.registerSchemesAsPrivileged([
      { scheme: "app", privileges: { secure: true, standard: true } },
    ]);

    // 主应用程序事件
    this.mainAppEvents();
  }

  // 创建主窗口
  createWindow() {
    // 创建浏览器窗口
    this.mainWindow = new BrowserWindow({
      title: app.getName() || "SPlayer",
      width: this.store.get("windowSize.width") || 1280, // 窗口宽度
      height: this.store.get("windowSize.height") || 740, // 窗口高度
      minHeight: 700, // 最小高度
      minWidth: 1200, // 最小宽度
      center: true, // 是否出现在屏幕居中的位置
      show: false, // 初始时不显示窗口
      frame: false, // 无边框
      // transparent: true, // 透明窗口
      titleBarStyle: "customButtonsOnHover", // Macos 隐藏菜单栏
      autoHideMenuBar: true, // 失去焦点后自动隐藏菜单栏
      // 图标配置
      icon: nativeImage.createFromPath(join(__dirname, "../../public/imgs/icons/favicon.png")),
      // 预加载
      webPreferences: {
        // devTools: is.dev,
        preload: join(__dirname, "../preload/index.mjs"),
        sandbox: false,
        webSecurity: false,
        hardwareAcceleration: true,
      },
    });

    // 窗口准备就绪时显示窗口
    this.mainWindow.once("ready-to-show", () => {
      this.mainWindow.show();
      // mainWindow.maximize();
      this.store.set("windowSize", this.mainWindow.getBounds());
    });

    // 主窗口事件
    this.mainWindowEvents();

    // 设置窗口打开处理程序
    this.mainWindow.webContents.setWindowOpenHandler((details) => {
      shell.openExternal(details.url);
      return { action: "deny" };
    });

    // 渲染路径
    // 在开发模式
    if (is.dev && process.env.ELECTRON_RENDERER_URL) {
      this.mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
    }
    // 生产模式
    else {
      console.log("生产模式渲染端口: " + process.env.MAIN_VITE_MAIN_PORT ?? 7899);
      this.mainWindow.loadURL(`http://127.0.0.1:${process.env.MAIN_VITE_MAIN_PORT ?? 7899}`);
    }

    // 配置网络代理
    const proxyRules = this.store.get("proxy");
    if (proxyRules) {
      this.mainWindow.webContents.session.setProxy({ proxyRules }, (result) => {
        console.info("网络代理配置：", result);
      });
    }
  }

  // 主应用程序事件
  mainAppEvents() {
    app.whenReady().then(async () => {
      // 创建主窗口
      this.createWindow();
      // 引入主 Ipc，并传递MainProcess实例
      const { setMainProcessInstance } = mainIpcMain(this.mainWindow, this.store);
      setMainProcessInstance(this); // 传递this实例
      // 系统托盘
      // 初始化系统托盘，并传入 store 实例以访问持久化的快捷键配置，支持实时更新状态栏菜单
      createSystemTray(this.mainWindow, this.store);
      // 注册快捷键
      createGlobalShortcut(this.mainWindow);
    });

    // 开发环境下 F12 打开控制台
    app.on("browser-window-created", (_, window) => {
      optimizer.watchWindowShortcuts(window);
    });

    // 在 macOS 上，当单击 Dock 图标且没有其他窗口时，通常会重新创建窗口
    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) this.createWindow();
    });

    // 自定义协议
    app.on("open-url", (_, url) => {
      console.log("Received custom protocol URL:", url);
    });

    // 将要退出
    app.on("will-quit", () => {
      // 注销全部快捷键
      globalShortcut.unregisterAll();
    });

    // 当所有窗口都关闭时退出应用，macOS 除外
    app.on("window-all-closed", () => {
      if (!platform.isMacOS) {
        app.quit();
      }
    });
  }

  // 主窗口事件
  mainWindowEvents() {
    this.mainWindow.on("show", () => {
      this.mainWindow.webContents.send("lyricsScroll");
    });

    // this.mainWindow.on("hide", () => {
    //   console.info("窗口隐藏");
    // });

    this.mainWindow.on("focus", () => {
      this.mainWindow.webContents.send("lyricsScroll");
    });

    // this.mainWindow.on("blur", () => {
    //   console.info("窗口失去焦点");
    // });

    this.mainWindow.on("maximize", () => {
      this.mainWindow.webContents.send("windowState", true);
    });

    this.mainWindow.on("unmaximize", () => {
      this.mainWindow.webContents.send("windowState", false);
    });

    this.mainWindow.on("resize", () => {
      this.store.set("windowSize", this.mainWindow.getBounds());
    });

    this.mainWindow.on("move", () => {
      this.store.set("windowSize", this.mainWindow.getBounds());
    });

    // 窗口关闭
    this.mainWindow.on("close", (event) => {
      event.preventDefault();
      if (!app.isQuiting) {
        this.mainWindow.hide();
      } else {
        app.exit();
      }
    });
  }
  
  // 创建桌面歌词窗口
  createDesktopLyricsWindow() {
    console.log("🚀 开始创建桌面歌词窗口");

    try {
      // 如果窗口已存在且未销毁，直接显示并返回
      if (this.desktopLyricsWindow && !this.desktopLyricsWindow.isDestroyed()) {
        console.log("桌面歌词窗口已存在，直接显示");
        this.desktopLyricsWindow.show();
        return;
      }
      
      // 如果存在但已销毁，清空引用
      if (this.desktopLyricsWindow && this.desktopLyricsWindow.isDestroyed()) {
        console.log("清理已销毁的桌面歌词窗口引用");
        this.desktopLyricsWindow = null;
      }

      // 获取窗口配置，添加默认值以防止配置为空
      const config = this.store.get("desktopLyricsWindowConfig") || {};
      
      // 打印配置信息，便于调试
      console.log("桌面歌词窗口配置:", {
        width: config.width,
        height: config.height,
        x: config.x,
        y: config.y,
        alwaysOnTop: config.alwaysOnTop
      });
    
    // 确保配置有效
    const validConfig = {
      width: config.width || 800,
      height: config.height || 200,
      x: (config.x >= 0 && config.x < 3000) ? config.x : undefined,
      y: (config.y >= 0 && config.y < 2000) ? config.y : undefined,
      alwaysOnTop: !!config.alwaysOnTop
    };
    
    // 获取屏幕信息
    const { screen } = require('electron');
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;
    
    // 如果没有指定位置，或位置在屏幕外，则居中显示
    if (validConfig.x === undefined || validConfig.y === undefined || 
        validConfig.x > screenWidth || validConfig.y > screenHeight) {
      validConfig.x = Math.floor((screenWidth - validConfig.width) / 2);
      validConfig.y = Math.floor(screenHeight * 0.2); // 屏幕上方20%位置
      console.log("重置桌面歌词窗口位置:", validConfig.x, validConfig.y);
    }
    
    this.desktopLyricsWindow = new BrowserWindow({
      title: "SPlayer - 桌面歌词",
      width: validConfig.width,
      height: validConfig.height,
      x: validConfig.x,
      y: validConfig.y,
      minWidth: 400,           // 最小宽度
      minHeight: 100,          // 最小高度
      frame: false,            // 无边框
      transparent: true,       // 透明窗口
      opacity: 0.95,          // 初始不透明度设置为高一点
      resizable: true,         // 可调整大小
      alwaysOnTop: true,       // 总是置顶，确保可见
      skipTaskbar: true,       // 不显示在任务栏
      show: false,             // 初始不显示（等ready-to-show）
      hasShadow: false,        // 无阴影（Windows/macOS）
      backgroundColor: '#00000000', // 透明背景
      webPreferences: {
        preload: join(__dirname, "../preload/index.mjs"),
        sandbox: false,
        webSecurity: false,
        nodeIntegration: true,
        contextIsolation: false,
        backgroundThrottling: false, // 防止后台时节流动画
      },
    });

    // 窗口准备就绪时显示
    this.desktopLyricsWindow.once("ready-to-show", () => {
      console.log("桌面歌词窗口准备就绪，准备显示");
      
      try {
        // 确保窗口在屏幕上可见
        const bounds = this.desktopLyricsWindow.getBounds();
        console.log("桌面歌词窗口当前位置和大小:", bounds);
        
        // 强制设置窗口大小和位置，确保可见
        const { screen } = require('electron');
        const primaryDisplay = screen.getPrimaryDisplay();
        const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;
        
        // 设置一个确定可见的位置和大小
        const visibleBounds = {
          width: Math.min(bounds.width, 800),
          height: Math.min(bounds.height, 200),
          x: Math.floor((screenWidth - bounds.width) / 2),
          y: Math.floor(screenHeight * 0.2) // 屏幕上方20%位置
        };
        
        console.log("强制设置桌面歌词窗口位置和大小:", visibleBounds);
        this.desktopLyricsWindow.setBounds(visibleBounds);
        
        // 确保窗口在前台并可见
        this.desktopLyricsWindow.setAlwaysOnTop(true);
        this.desktopLyricsWindow.setBackgroundColor('#000000BB'); // 设置半透明黑色背景
        this.desktopLyricsWindow.setOpacity(0.95); // 确保不透明度适中
        
        // 检查窗口内容是否已加载
        const url = this.desktopLyricsWindow.webContents.getURL();
        console.log("桌面歌词窗口当前加载URL:", url);
        
        if (!url || url === '') {
          console.warn("桌面歌词窗口内容未加载，尝试重新加载");
          this._reloadDesktopLyricsWindow();
          
          // 给一点时间让内容加载
          setTimeout(() => {
            this.desktopLyricsWindow.show();
            this.desktopLyricsWindow.focus();
            
            // 通知主窗口桌面歌词已显示
            if (this.mainWindow && !this.mainWindow.isDestroyed()) {
              this.mainWindow.webContents.send("desktop-lyrics-shown");
            }
          }, 500);
        } else {
          // 显示窗口 - 确保窗口可见
          console.log("开始显示桌面歌词窗口并设置焦点");
          this.desktopLyricsWindow.setSize(800, 200); // 强制设置一个明确的大小
          this.desktopLyricsWindow.center(); // 居中显示
          this.desktopLyricsWindow.setVisibleOnAllWorkspaces(true); // 在所有工作区可见
          this.desktopLyricsWindow.setAlwaysOnTop(true, "floating"); // 悬浮窗模式
          this.desktopLyricsWindow.show();
          this.desktopLyricsWindow.focus();
          
          // 尝试重新设置透明度
          setTimeout(() => {
            if (this.desktopLyricsWindow && !this.desktopLyricsWindow.isDestroyed()) {
              console.log("重新设置桌面歌词窗口透明度");
              this.desktopLyricsWindow.setOpacity(0.95);
              this.desktopLyricsWindow.setBackgroundColor('#000000AA');
            }
          }, 300);
          
          // 通知主窗口桌面歌词已显示
          if (this.mainWindow && !this.mainWindow.isDestroyed()) {
            this.mainWindow.webContents.send("desktop-lyrics-shown");
          }
        }
        
        // 调试信息
        console.log("桌面歌词窗口显示后的状态:", {
          isVisible: this.desktopLyricsWindow.isVisible(),
          isMinimized: this.desktopLyricsWindow.isMinimized(),
          isMaximized: this.desktopLyricsWindow.isMaximized(),
          isFullScreen: this.desktopLyricsWindow.isFullScreen(),
          bounds: this.desktopLyricsWindow.getBounds()
        });
        
        // 延迟恢复用户设置的置顶状态
        setTimeout(() => {
          if (this.desktopLyricsWindow && !this.desktopLyricsWindow.isDestroyed()) {
            const shouldBeOnTop = !!this.store.get("desktopLyricsWindowConfig.alwaysOnTop", false);
            console.log("恢复用户设置的置顶状态:", shouldBeOnTop);
            this.desktopLyricsWindow.setAlwaysOnTop(shouldBeOnTop);
          }
        }, 2000);
        
        console.log("桌面歌词窗口已显示");
      } catch (error) {
        console.error("显示桌面歌词窗口时出错:", error);
        
        // 通知主窗口显示失败
        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
          this.mainWindow.webContents.send("desktop-lyrics-error", {
            message: "显示桌面歌词窗口失败",
            error: error.toString()
          });
        }
      }
    });

    // 绑定窗口事件
    this.desktopLyricsWindowEvents();

    // 加载页面（关键：加载独立HTML）
    try {
      if (is.dev && process.env.ELECTRON_RENDERER_URL) {
        // 开发环境：加载desktop-lyrics.html
        const url = `${process.env.ELECTRON_RENDERER_URL}/desktop-lyrics.html`;
        console.log("开发环境加载桌面歌词URL:", url);
        this.desktopLyricsWindow.loadURL(url);
      } else {
        // 生产环境：加载构建后的desktop-lyrics.html
        const filePath = join(__dirname, "../renderer/desktop-lyrics.html");
        console.log("生产环境加载桌面歌词文件:", filePath);
        
        // 检查文件是否存在
        try {
          const fs = require('fs');
          if (fs.existsSync(filePath)) {
            console.log("桌面歌词文件存在，正在加载...");
            this.desktopLyricsWindow.loadFile(filePath);
          } else {
            console.error("桌面歌词文件不存在:", filePath);
            // 尝试使用备用方法 - 直接从项目根目录加载
            const rootPath = join(__dirname, "../../desktop-lyrics.html");
            if (fs.existsSync(rootPath)) {
              console.log("使用根目录备用文件:", rootPath);
              this.desktopLyricsWindow.loadFile(rootPath);
            } else {
              console.error("桌面歌词文件在根目录也不存在:", rootPath);
              this.desktopLyricsWindow.loadFile(join(__dirname, "../renderer/index.html"));
            }
          }
        } catch (fsError) {
          console.error("检查桌面歌词文件时出错:", fsError);
          this.desktopLyricsWindow.loadFile(join(__dirname, "../renderer/index.html"));
        }
      }
    } catch (error) {
      console.error("加载桌面歌词窗口失败:", error);
      
      // 通知主窗口加载失败
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.webContents.send("desktop-lyrics-error", {
          message: "桌面歌词窗口加载失败",
          error: error.toString()
        });
      }
    }

    // 开发环境打开DevTools
    if (is.dev) {
      this.desktopLyricsWindow.webContents.openDevTools({ mode: 'detach' });
    }
    
    // 添加页面加载失败事件监听
    this.desktopLyricsWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
      console.error("桌面歌词页面加载失败:", errorCode, errorDescription);
      
      // 通知主窗口加载失败
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.webContents.send("desktop-lyrics-error", {
          message: `桌面歌词页面加载失败: ${errorDescription}`,
          errorCode
        });
      }
    });
  } catch (error) {
    // 捕获整个函数的任何错误
    console.error("创建桌面歌词窗口时发生严重错误:", error);
    
    // 通知主窗口创建失败
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send("desktop-lyrics-error", {
        message: "创建桌面歌词窗口失败",
        error: error.toString()
      });
    }
  }
  }
  
  // 重新加载桌面歌词窗口内容
  _reloadDesktopLyricsWindow() {
    try {
      if (!this.desktopLyricsWindow || this.desktopLyricsWindow.isDestroyed()) {
        console.error("无法重载桌面歌词窗口：窗口对象不存在或已销毁");
        return;
      }
      
      const is = process.env.NODE_ENV !== "production";
      const { join } = require('path');
      
      if (is.dev && process.env.ELECTRON_RENDERER_URL) {
        const url = `${process.env.ELECTRON_RENDERER_URL}/desktop-lyrics.html`;
        console.log("重新加载桌面歌词URL:", url);
        this.desktopLyricsWindow.loadURL(url);
      } else {
        const fs = require('fs');
        const rootPath = join(__dirname, "../../desktop-lyrics.html");
        
        if (fs.existsSync(rootPath)) {
          console.log("重载桌面歌词：使用根目录文件");
          this.desktopLyricsWindow.loadFile(rootPath);
        } else {
          console.error("重载桌面歌词：文件不存在");
          this.desktopLyricsWindow.loadFile(join(__dirname, "../renderer/index.html"));
        }
      }
    } catch (error) {
      console.error("重载桌面歌词窗口失败:", error);
    }
  }

  // 桌面歌词窗口事件处理
  desktopLyricsWindowEvents() {
    // 窗口移动 - 保存位置
    this.desktopLyricsWindow.on("move", () => {
      if (!this.desktopLyricsWindow) return;
      const bounds = this.desktopLyricsWindow.getBounds();
      this.store.set("desktopLyricsWindowConfig.x", bounds.x);
      this.store.set("desktopLyricsWindowConfig.y", bounds.y);
    });

    // 窗口大小调整 - 保存大小
    this.desktopLyricsWindow.on("resize", () => {
      if (!this.desktopLyricsWindow) return;
      const bounds = this.desktopLyricsWindow.getBounds();
      this.store.set("desktopLyricsWindowConfig.width", bounds.width);
      this.store.set("desktopLyricsWindowConfig.height", bounds.height);
    });

    // 窗口关闭 - 隐藏而非销毁
    this.desktopLyricsWindow.on("close", (event) => {
      // 检查是否来自 hideDesktopLyricsWindow 调用
      if (!this._isManualHiding) {
        event.preventDefault(); // 阻止默认关闭行为
        this.desktopLyricsWindow.hide();
        
        // 通知主窗口桌面歌词已关闭
        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
          this.mainWindow.webContents.send("desktop-lyrics-closed");
        }
        
        console.log("桌面歌词窗口已隐藏 (通过关闭按钮)");
      }
    });

    // 窗口销毁 - 清理引用
    this.desktopLyricsWindow.on("closed", () => {
      console.log("桌面歌词窗口已销毁");
      
      // 在销毁后才清空引用，避免可能的空引用问题
      setTimeout(() => {
        // 确保桌面歌词窗口状态已同步到主窗口
        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
          this.mainWindow.webContents.send("desktop-lyrics-closed");
        }
        
        // 清理引用
        this.desktopLyricsWindow = null;
      }, 100);
    });
  }

  // 显示桌面歌词窗口
  showDesktopLyricsWindow() {
    console.log("准备显示桌面歌词窗口");
    
    try {
      if (!this.desktopLyricsWindow || this.desktopLyricsWindow.isDestroyed()) {
        console.log("桌面歌词窗口不存在或已销毁，创建新窗口");
        this.createDesktopLyricsWindow();
        
        // 添加额外检查以确认窗口是否成功创建
        setTimeout(() => {
          if (!this.desktopLyricsWindow) {
            console.error("桌面歌词窗口创建失败，窗口对象为空");
            // 通知主窗口创建失败
            if (this.mainWindow && !this.mainWindow.isDestroyed()) {
              this.mainWindow.webContents.send("desktop-lyrics-error", {
                message: "桌面歌词窗口创建失败"
              });
            }
          } else if (this.desktopLyricsWindow.isDestroyed()) {
            console.error("桌面歌词窗口创建后立即被销毁");
            // 通知主窗口创建失败
            if (this.mainWindow && !this.mainWindow.isDestroyed()) {
              this.mainWindow.webContents.send("desktop-lyrics-error", {
                message: "桌面歌词窗口创建后立即被销毁"
              });
            }
          } else if (!this.desktopLyricsWindow.isVisible()) {
            console.warn("桌面歌词窗口已创建但未显示，尝试显示");
            this.desktopLyricsWindow.show();
          }
        }, 1000);
      } else if (!this.desktopLyricsWindow.isVisible()) {
        console.log("桌面歌词窗口存在但不可见，显示窗口");
        // 确保窗口在屏幕上可见
        const { screen } = require('electron');
        const primaryDisplay = screen.getPrimaryDisplay();
        const { width, height } = primaryDisplay.workAreaSize;
        
        // 获取当前窗口位置
        const bounds = this.desktopLyricsWindow.getBounds();
        console.log("当前桌面歌词窗口位置:", bounds);
        
        // 如果窗口位置在屏幕外，重置到屏幕中央
        if (bounds.x < 0 || bounds.x > width || bounds.y < 0 || bounds.y > height) {
          console.log("桌面歌词窗口位置不在屏幕内，重置位置");
          this.desktopLyricsWindow.center();
        }
        
        // 确保窗口已加载内容
        if (this.desktopLyricsWindow.webContents.getURL() === '') {
          console.warn("桌面歌词窗口内容未加载，尝试重新加载");
          this._reloadDesktopLyricsWindow();
        }
        
      this.desktopLyricsWindow.show();
      console.log("桌面歌词窗口已显示");
      
      // 通知主窗口桌面歌词已显示
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        console.log("发送桌面歌词窗口显示通知到主窗口");
        this.mainWindow.webContents.send("desktop-lyrics-shown");
        
        // 延迟再发送一次，确保渲染进程已准备好接收
        setTimeout(() => {
          if (this.mainWindow && !this.mainWindow.isDestroyed()) {
            console.log("再次发送桌面歌词窗口显示通知");
            this.mainWindow.webContents.send("desktop-lyrics-shown");
          }
        }, 1000);
      }
      } else {
        console.log("桌面歌词窗口已经可见，无需操作");
      }
    } catch (error) {
      console.error("显示桌面歌词窗口时发生异常:", error);
      
      // 通知主窗口显示失败
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.webContents.send("desktop-lyrics-error", {
          message: "显示桌面歌词窗口失败",
          error: error.toString()
        });
      }
    }
  }
  
  // 重新加载桌面歌词窗口内容
  _reloadDesktopLyricsWindow() {
    try {
      if (!this.desktopLyricsWindow || this.desktopLyricsWindow.isDestroyed()) {
        console.error("无法重载桌面歌词窗口：窗口对象不存在或已销毁");
        return;
      }
      
      const is = process.env.NODE_ENV !== "production";
      const { join } = require('path');
      
      if (is.dev && process.env.ELECTRON_RENDERER_URL) {
        const url = `${process.env.ELECTRON_RENDERER_URL}/desktop-lyrics.html`;
        console.log("重新加载桌面歌词URL:", url);
        this.desktopLyricsWindow.loadURL(url);
      } else {
        const fs = require('fs');
        const rootPath = join(__dirname, "../../desktop-lyrics.html");
        
        if (fs.existsSync(rootPath)) {
          console.log("重载桌面歌词：使用根目录文件");
          this.desktopLyricsWindow.loadFile(rootPath);
        } else {
          console.error("重载桌面歌词：文件不存在");
          this.desktopLyricsWindow.loadFile(join(__dirname, "../renderer/index.html"));
        }
      }
    } catch (error) {
      console.error("重载桌面歌词窗口失败:", error);
    }
  }

  // 隐藏桌面歌词窗口
  hideDesktopLyricsWindow() {
    if (this.desktopLyricsWindow) {
      // 设置标记，表明这是手动隐藏而不是用户关闭
      this._isManualHiding = true;
      
      this.desktopLyricsWindow.hide();
      console.log("桌面歌词窗口已隐藏 (通过API调用)");
      
      // 通知主窗口桌面歌词已关闭
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.webContents.send("desktop-lyrics-closed");
      }
      
      // 重置标记
      setTimeout(() => {
        this._isManualHiding = false;
      }, 100);
    }
  }

  // 切换桌面歌词窗口显示状态
  // 检查桌面歌词窗口是否可见
  isDesktopLyricsVisible() {
    return this.desktopLyricsWindow && !this.desktopLyricsWindow.isDestroyed() && this.desktopLyricsWindow.isVisible();
  }
  
  toggleDesktopLyricsWindow() {
    if (!this.isDesktopLyricsVisible()) {
      console.log("桌面歌词窗口当前不可见，准备显示");
      this.showDesktopLyricsWindow();
    } else {
      console.log("桌面歌词窗口当前可见，准备隐藏");
      this.hideDesktopLyricsWindow();
    }
  }

  // 设置桌面歌词窗口总是置顶
  setDesktopLyricsAlwaysOnTop(flag) {
    if (this.desktopLyricsWindow) {
      this.desktopLyricsWindow.setAlwaysOnTop(flag);
      this.store.set("desktopLyricsWindowConfig.alwaysOnTop", flag);
    }
  }
}

new MainProcess();
