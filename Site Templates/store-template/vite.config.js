import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import webtool from 'webtool-devtool'

export default defineConfig({
  plugins: [react(), webtool()],
})
