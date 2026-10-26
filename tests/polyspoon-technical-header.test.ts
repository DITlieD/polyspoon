import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {chromium} from 'playwright-core';

test('technical header has readable brand and unclipped keyboard controls at desktop and narrow widths',{timeout:45000},async()=>{
 const base=process.env.RECIPE_SITE_URL,output=process.env.TECHNICAL_HEADER_EVIDENCE_ROOT;assert.ok(base&&output);assert.ok(['127.0.0.1','localhost'].includes(new URL(base).hostname));assert.ok(resolve(output).startsWith(resolve('evidence')+'/'));await mkdir(output,{recursive:true});
 const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});const records:unknown[]=[];
 try{
  const page=await browser.newPage();
  for(const width of [1440,390]){
   await page.setViewportSize({width,height:844});await page.goto(new URL('/editor',base).href);await page.waitForLoadState('networkidle');await page.screenshot({path:join(output,'editor-'+width+'.png'),fullPage:true});
   const record=await page.evaluate(()=>{const header=document.querySelector<HTMLElement>('.topbar')!,brand=header.querySelector<HTMLElement>('.brand')!,rect=header.getBoundingClientRect();return {width:innerWidth,header:{top:rect.top,bottom:rect.bottom,height:rect.height},brandColor:getComputedStyle(brand).color,background:getComputedStyle(header).backgroundColor,spoonWidth:brand.querySelector('svg')!.getBoundingClientRect().width,controls:[...header.querySelectorAll<HTMLElement>('.brand,select,button')].map(e=>{const r=e.getBoundingClientRect();return {id:e.id||e.className,left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height};})};});
   const luminance=(rgb:string)=>{const v=rgb.match(/[\d.]+/g)!.slice(0,3).map(Number).map(n=>n/255).map(n=>n<=.04045?n/12.92:((n+.055)/1.055)**2.4);return v[0]!*.2126+v[1]!*.7152+v[2]!*.0722;};const values=[luminance(record.brandColor),luminance(record.background)].sort((a,b)=>a-b);const contrast=(values[1]!+.05)/(values[0]!+.05);assert.ok(contrast>=4.5,'Technical brand contrast '+contrast);
   assert.ok(record.spoonWidth>=20,'Spoon remains visible');assert.ok(record.header.top>=0);
   for(const control of record.controls){assert.ok(control.width>0&&control.height>0,control.id);assert.ok(control.left>=0&&control.right<=width,JSON.stringify(control));assert.ok(control.top>=record.header.top&&control.bottom<=record.header.bottom,JSON.stringify(control));}
   await page.locator('.brand').focus();assert.equal(await page.locator('.brand').evaluate(e=>e===document.activeElement),true);await page.keyboard.press('Tab');assert.equal(await page.locator('#family').evaluate(e=>e===document.activeElement),true);await page.keyboard.press('Tab');assert.equal(await page.locator('#preset').evaluate(e=>e===document.activeElement),true);await page.locator('#load').focus();assert.equal(await page.locator('#load').evaluate(e=>e===document.activeElement),true);
   assert.equal((await page.locator('#show-workshop').innerText()).replace(/\s+/g,''),'▦Scene');await page.locator('#show-workshop').click();await page.locator('#back-editor').waitFor({state:'visible'});assert.equal(await page.locator('#view-status').innerText(),'Scene preview');await page.locator('#back-editor').click();await page.locator('#inspector').waitFor({state:'visible'});records.push({...record,contrast,keyboard:true,sceneReturned:true});
  }
  await writeFile(join(output,'receipt.json'),JSON.stringify({base,records},null,2)+'\n');
 }finally{await browser.close();}
});
