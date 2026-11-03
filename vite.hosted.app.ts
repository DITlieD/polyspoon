import {defineConfig} from 'vite';
import {resolve} from 'node:path';
export default defineConfig({root:resolve('hosted/app'),publicDir:false,base:'/app/',build:{target:'es2023',assetsDir:'assets',rollupOptions:{preserveEntrySignatures:'exports-only',input:{index:resolve('hosted/app/index.html'),hero:resolve('hosted/app/hero.ts')},output:{entryFileNames:chunk=>chunk.name==='hero'?'hero.js':'assets/[name]-[hash].js'}},outDir:resolve('hosted/build/app'),emptyOutDir:false,sourcemap:false}});
