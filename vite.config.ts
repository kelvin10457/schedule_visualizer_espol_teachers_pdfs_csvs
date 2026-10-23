import { defineConfig } from 'vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import tailwindcss from '@tailwindcss/vite'
import { rmSync } from 'node:fs'
import { resolve } from 'node:path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    tailwindcss(),
    react(),
    babel({ presets: [reactCompilerPreset()] }),
    // public/new_data/ tiene reportes y tablas reales de la coordinación para probar en
    // local; no deben terminar en el sitio publicado.
    {
      name: 'exclude-local-data',
      apply: 'build',
      closeBundle() {
        rmSync(resolve(__dirname, 'dist/new_data'), { recursive: true, force: true })
      },
    },
  ],
})
