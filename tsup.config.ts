import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  sourcemap: true,
  clean: true,
  external: ['next', 'react', 'react-dom'],
  banner: {
    js: '// @postpress/next — https://github.com/postpress-site/postpress-next',
  },
})
