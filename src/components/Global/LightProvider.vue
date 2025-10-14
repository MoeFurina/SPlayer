<!-- 轻量级 Provider - 仅用于桌面歌词等独立窗口 -->
<template>
  <n-config-provider
    :locale="zhCN"
    :date-locale="dateZhCN"
    abstract
    inline-theme-disabled
  >
    <n-message-provider :max="1" placement="bottom">
      <slot />
      <NaiveProviderContent />
    </n-message-provider>
  </n-config-provider>
</template>

<script setup>
import { onMounted } from "vue";
import { zhCN, dateZhCN, useMessage } from "naive-ui";

// 设置Naive UI工具函数
const setupNaiveTools = () => {
  window.$message = useMessage();
};

// 用于触发setup的辅助组件
const NaiveProviderContent = {
  setup() {
    setupNaiveTools();
  },
  render() {
    return null;
  },
};

onMounted(() => {
  console.log("LightProvider组件已挂载");
});
</script>

<style lang="scss" scoped>
/* 不需要额外样式，由Naive UI提供 */
</style>