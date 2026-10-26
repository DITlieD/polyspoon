import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { chromium } from 'playwright-core';
import { mkdir,writeFile } from 'node:fs/promises';
import { buildAsset,disposeAsset } from '../src/catalog/index.ts';
import { sourceProvenance } from '../scripts/provenance.ts';

test('asset outline has visible 1, 2 and 4 pixel bands without outlining shadow',{timeout:60000},async()=>{
 const output='evidence/revision4/outline-visible';await mkdir(output,{recursive:true});
 const server=await createServer({server:{host:'127.0.0.1',port:0},logLevel:'error'});await server.listen();
 const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 const page=await browser.newPage({viewport:{width:1580,height:810},deviceScaleFactor:1}),errors:string[]=[];
 page.on('pageerror',error=>errors.push(error.message));
 await page.addInitScript('globalThis.__name = (value) => value;');
 try{
  await page.goto(server.resolvedUrls!.local[0]+'asset/fence');
  const fence=buildAsset('fence',{length:2,bays:1,railCount:2,height:1.1});
  const buffer=Buffer.from(JSON.stringify(fence.config));disposeAsset(fence);
  await page.locator('#file').setInputFiles({name:'fence.design.json',mimeType:'application/json',buffer});
  await page.waitForFunction(()=>document.getElementById('notice')?.textContent==='Design loaded.');
  const frames:Record<string,string>={};
  for(const mode of ['None','Thin1px','Medium2px','Heavy4px']){
   await page.getByRole('button',{name:'Outline',exact:true}).click();
   await page.getByRole('combobox',{name:'Outline',exact:true}).selectOption(mode);await page.keyboard.press('Escape');
   await page.evaluate(async()=>{for(let i=0;i<4;i++)await new Promise(requestAnimationFrame);});
   await page.locator('canvas').screenshot({path:output+'/'+mode+'.png'});
   frames[mode]=await page.locator('canvas').evaluate(canvas=>(canvas as HTMLCanvasElement).toDataURL());
  }
  const measured=await page.evaluate(async frames=>{
   const images:Record<string,Uint8ClampedArray>={};let width=0,height=0;
   for(const [name,url] of Object.entries(frames)){
    const image=new Image();image.src=url;await image.decode();width=image.width;height=image.height;
    const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;const context=canvas.getContext('2d')!;context.drawImage(image,0,0);images[name]=context.getImageData(0,0,width,height).data;
   }
   const base=images.None!;
   const luminance=(pixels:Uint8ClampedArray,x:number,y:number)=>{const i=(y*width+x)*4;return(pixels[i]!+pixels[i+1]!+pixels[i+2]!)/3;};
   const brown=(x:number,y:number)=>{const i=(y*width+x)*4;return base[i]!>base[i+1]!*1.12&&base[i+1]!>base[i+2]!*1.1;};
   const results:Record<string,unknown>={};
   for(const name of ['Thin1px','Medium2px','Heavy4px']){
    const current=images[name]!,widths:number[]=[],samples:unknown[]=[];let darkened=0,groundChanged=0;
    const dark=(x:number,y:number)=>luminance(base,x,y)-luminance(current,x,y)>25;
    for(let y=0;y<height;y++)for(let x=0;x<width;x++)if(dark(x,y)){
     darkened++;let nearAsset=false;
     for(let dx=-2;dx<=2;dx++)for(let dy=-2;dy<=2;dy++)if(x+dx>=0&&x+dx<width&&y+dy>=0&&y+dy<height&&brown(x+dx,y+dy))nearAsset=true;
     if(!nearAsset)groundChanged++;
    }
    for(let y=20;y<height*.75;y+=4){
     let x=0;
     while(x<width){
      while(x<width&&!brown(x,y))x++;const start=x;while(x<width&&brown(x,y))x++;const end=x;
      if(end-start<12||end-start>width*.8)continue;
      let count=0;while(count<8&&dark(start+count,y))count++;
      if(count){widths.push(count);if(samples.length<12)samples.push({x:start,y,width:count});}
     }
    }
    widths.sort((a,b)=>a-b);const median=widths[Math.floor(widths.length/2)]??0;
    results[name]={darkened,groundChanged,median,measurements:widths.length,samples};
   }
   return {width,height,results};
  },frames);
  await writeFile(output+'/measurements.json',JSON.stringify({measured,errors,provenance:await sourceProvenance()},null,2));
  const results=measured.results as Record<string,{darkened:number;groundChanged:number;median:number;measurements:number}>;
  for(const [name,width] of [['Thin1px',1],['Medium2px',2],['Heavy4px',4]] as const){
   assert.ok(results[name]!.darkened>250,name);assert.equal(results[name]!.groundChanged,0,name);assert.equal(results[name]!.median,width,name);
  }
  const compare=await browser.newPage({viewport:{width:1100,height:440}});
  await compare.setContent('<html><body style="margin:0;background:#f4f6fa;font:14px system-ui;display:flex">'+['None','Thin1px','Medium2px','Heavy4px'].map(name=>'<section style="width:25%;overflow:hidden"><h2 style="font-size:14px;margin:12px">'+name+'</h2><img style="width:940px;max-width:none;transform:translate(-175px,-80px)" src="'+frames[name]+'"></section>').join('')+'</body></html>');
  await compare.locator('img').evaluateAll(images=>Promise.all(images.map(image=>(image as HTMLImageElement).decode())));
  await compare.screenshot({path:output+'/crop-comparison.png'});
 }finally{await browser.close();await server.close();}
});
