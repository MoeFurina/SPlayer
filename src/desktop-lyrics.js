/**
 * 桌面歌词独立应用入口
 * 注意：此入口不应初始化主应用的任何功能（播放器、路由、完整Store等）
 */

// 异步加载所有依赖
Promise.all([
  import('vue'),
  import("pinia"),
  import("pinia-plugin-persistedstate"),
  import('./views/DesktopLyrics.vue'),
  import('./components/Global/LightProvider.vue')
]).then(([
  { createApp, h },
  { createPinia },
  piniaPluginPersistedstate,
  DesktopLyrics,
  LightProvider
]) => {
  // 创建Pinia实例
  const pinia = createPinia();
  pinia.use(piniaPluginPersistedstate.default || piniaPluginPersistedstate);

  // 创建轻量级Vue应用（不使用主应用的App.vue），使用LightProvider包裹
  const app = createApp({
    components: { 
      LightProvider: LightProvider.default || LightProvider, 
      DesktopLyrics: DesktopLyrics.default || DesktopLyrics 
    },
    render() {
      try {
        const lightProvider = LightProvider.default || LightProvider;
        const desktopLyrics = DesktopLyrics.default || DesktopLyrics;
        
        return h(lightProvider, {}, [
          h(desktopLyrics)
        ]);
      } catch (error) {
        console.error("Vue应用render函数出错:", error);
        // 返回一个简单的div作为fallback
        return h('div', { 
          style: 'color: red; padding: 20px; background: rgba(0,0,0,0.8);',
          innerHTML: 'Vue应用渲染出错: ' + error.message
        });
      }
    }
  });
  // 使用Pinia
  app.use(pinia);
  
  // 挂载应用
  app.mount('#app');
}).catch(error => {
  console.error('桌面歌词应用加载失败:', error);
  
  // 在页面上显示错误信息
  const errorDiv = document.createElement('div');
  errorDiv.innerHTML = `
    <div style="color: red; font-size: 20px; font-weight: bold; margin-bottom: 10px;">
      ❌ 桌面歌词应用加载失败！
    </div>
    <div style="color: white; font-size: 14px; margin-bottom: 5px;">
      错误: ${error.message}
    </div>
    <div style="color: white; font-size: 12px;">
      请检查控制台获取详细信息
    </div>
  `;
  errorDiv.style.position = 'absolute';
  errorDiv.style.top = '50%';
  errorDiv.style.left = '50%';
  errorDiv.style.transform = 'translate(-50%, -50%)';
  errorDiv.style.background = 'rgba(255,0,0,0.9)';
  errorDiv.style.padding = '30px';
  errorDiv.style.borderRadius = '10px';
  errorDiv.style.textAlign = 'center';
  errorDiv.style.zIndex = '9999';
  errorDiv.style.maxWidth = '400px';
  document.body.appendChild(errorDiv);
});




