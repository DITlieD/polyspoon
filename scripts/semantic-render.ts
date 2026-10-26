import { mkdir,writeFile } from 'node:fs/promises';
import { resolve,join } from 'node:path';
import { chromium } from 'playwright-core';
import { createServer } from 'vite';
import { sourceProvenance } from './provenance.ts';
const output=resolve(process.argv[2]??'evidence/revision11/semantic-contract/render-01');await mkdir(output,{recursive:false});
const before=await sourceProvenance(),server=await createServer({server:{host:'127.0.0.1',port:0},logLevel:'error'});await server.listen();
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH??'/usr/bin/google-chrome',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
const results=[],errors:string[]=[];
try{for(const [family,posed] of [['wheelbarrow',55],['treasure-chest',70],['stone-well',65]] as const)for(const angle of [0,posed]){
 const page=await browser.newPage({viewport:{width:768,height:768},deviceScaleFactor:1});page.on('pageerror',error=>errors.push(error.message));
 await page.goto(server.resolvedUrls!.local[0]+'evidence/revision11/semantic-contract/fixture.html?family='+family+'&angle='+angle);
 await page.waitForFunction(()=>Boolean((window as any).semanticRender?.ready));await page.evaluate(async()=>{for(let i=0;i<3;i++)await new Promise(requestAnimationFrame);});
 const state=await page.evaluate(()=>(window as any).semanticRender);const filename=family+'-'+(angle?'posed':'default')+'.png';await page.screenshot({path:join(output,filename)});results.push({...state,filename});await page.close();
}}finally{await browser.close();await server.close();}
const after=await sourceProvenance();await writeFile(join(output,'receipt.json'),JSON.stringify({before,after,stable:before.sourceHash===after.sourceHash,results,errors},null,2));
if(errors.length||before.sourceHash!==after.sourceHash)throw new Error('Render fixture failed or source changed');console.log(JSON.stringify({renders:results.length,errors}));
