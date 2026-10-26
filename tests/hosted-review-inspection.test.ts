import test from 'node:test';
import assert from 'node:assert/strict';
import {rasterType} from '../hosted/app/review-inspection.ts';

test('sealed raster inspection accepts bounded PNG/JPEG and refuses active or excessive content',()=>{
 const png=new Uint8Array(24);png.set([137,80,78,71,13,10,26,10]);png.set([73,72,68,82],12);new DataView(png.buffer).setUint32(16,512);new DataView(png.buffer).setUint32(20,512);assert.equal(rasterType(png),'image/png');
 const jpeg=new Uint8Array([255,216,255,192,0,8,8,0,32,0,64,1]);assert.equal(rasterType(jpeg),'image/jpeg');
 assert.throws(()=>rasterType(new TextEncoder().encode('<svg onload="run()"></svg>')),/PNG or JPEG/);assert.throws(()=>rasterType(jpeg.subarray(0,8)),/PNG or JPEG/);new DataView(png.buffer).setUint32(16,100000);assert.throws(()=>rasterType(png),/dimensions/);
});
