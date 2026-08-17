import { defineConfig } from 'vite'
import { fileURLToPath, URL } from 'node:url'
import { resolve } from 'node:path'
import dts from 'vite-plugin-dts'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

export default defineConfig({
  plugins: [
    dts({
      include: ['src/**/*.ts'],
      outDir: 'dist',
    }),
  ],
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'MPBridge',
      formats: ['es', 'cjs'],
      fileName: (format) => format === 'es' ? 'mp-bridge.js' : 'mp-bridge.cjs',
      // axios 作为外部依赖，不打包进 SDK
    },
    rollupOptions: {
      external: ['axios'],
    },
  },
})
