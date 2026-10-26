import {defineConfig} from 'vite';
import {resolve} from 'node:path';
export default defineConfig({root:resolve('hosted/app'),publicDir:false,base:'/app/',build:{target:'es2023',assetsDir:'assets',outDir:resolve('hosted/build/app'),emptyOutDir:false,sourcemap:false}});
