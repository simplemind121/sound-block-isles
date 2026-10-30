import { defineConfig } from 'vite';

export default defineConfig({
  // 相对路径：dist 可以放在服务器的任意目录下
  base: './',
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      output: { manualChunks: { phaser: ['phaser'] } },
    },
  },
});
