import {defineConfig} from 'vite';
import {resolve} from 'node:path';
export default defineConfig({root:resolve('hosted/public'),publicDir:false,base:'/',build:{target:'es2023',assetsDir:'public-assets',outDir:resolve('hosted/build/public'),emptyOutDir:false,sourcemap:false}});
