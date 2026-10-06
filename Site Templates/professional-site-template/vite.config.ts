import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
// @ts-expect-error — plain JS plugin, no types
import webtool from 'webtool-devtool'

export default defineConfig({
  plugins: [react(), webtool()],
})
