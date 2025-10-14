<!-- 桌面歌词窗口页面 -->
<template>
  <!-- 使用桌面歌词窗口组件 -->
  <DesktopLyricsWindow />
</template>

<script setup>
import { onMounted } from "vue";
import DesktopLyricsWindow from "@/components/Player/DesktopLyricsWindow.vue";

onMounted(() => {
  console.log("桌面歌词窗口已挂载");
  console.log("Electron API:", typeof window.electron !== "undefined" ? "可用" : "不可用");
  
  // 检查DesktopLyricsWindow组件是否正确渲染
  setTimeout(() => {
    const windowElement = document.querySelector('.desktop-lyrics-window');
    console.log("DesktopLyrics组件渲染检查:", {
      windowElement: windowElement ? "存在" : "不存在"
    });
    
    if (!windowElement) {
      console.error("DesktopLyricsWindow组件未正确渲染！");
    } else {
      console.log("✅ DesktopLyricsWindow组件已正确渲染");
    }
  }, 500);
});
</script>

<style lang="scss" scoped>
/* 不需要样式，由DesktopLyricsWindow组件提供 */
</style>




