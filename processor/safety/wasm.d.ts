// esbuild bundles .wasm files as bytes (loader: binary) for the in-jail NSFW classifier.
declare module '*.wasm'{const bytes:Uint8Array;export default bytes;}
