export const config = {
  ssr: false,

  buildDir: "vue/.nuxt",
  /**
   * 配置实验性功能
   * 禁用 payloadExtraction 功能，该功能可能用于提取页面的有效负载数据
   * 这里禁用它可能是为了避免某些兼容性问题或特定的项目需求
   */
  experimental: {
    payloadExtraction: false,
  },
};
