export const config = {
  ssr: false,
  buildDir: "vue/.nuxt", // 设置构建目录为 "vue/.nuxt"，表示 Nuxt 项目的构建输出将存放在该目录下
  srcDir: "vue", // 设置源代码目录为 "vue"，表示 Nuxt 项目的源代码将存放在该目录下
  /**
   * 配置实验性功能
   * 禁用 payloadExtraction 功能，该功能可能用于提取页面的有效负载数据
   * 这里禁用它可能是为了避免某些兼容性问题或特定的项目需求
   */
  experimental: {
    payloadExtraction: false,
  },
  // 配置 Nuxt DevTools
  // 启用时间线功能，可能用于调试和性能分析
  devtools: {
    timeline: {
      enabled: true,
    },
  },
};

export default config;
