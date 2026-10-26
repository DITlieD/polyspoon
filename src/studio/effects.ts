import { Vector2 } from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutlinePass } from 'three/addons/postprocessing/OutlinePass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import type { Camera, Scene, WebGLRenderer, Object3D } from 'three';

export const effectChoices={
 underwater:['None','Shallow','Reef','Deep','Murky'],
 dither:['None','Fine8','Medium6','Coarse4'],
 wobble:['None','Subtle','Wobble','PS1'],
 outline:['None','Thin1px','Medium2px','Heavy4px'],
 wireframe:['None','Creases','Mesh','Ghost'],
 pixelate:['None','half','quarter','eighth'],
} as const;
export type EffectKey=keyof typeof effectChoices;
export class ViewerEffects {
 private readonly composer:EffectComposer;
 private readonly pass:ShaderPass;
 private readonly output=new OutputPass();
 private readonly outline:OutlinePass;
 private active=false;
 private readonly values:Record<string,string>={};
 constructor(renderer:WebGLRenderer,scene:Scene,camera:Camera){
  this.composer=new EffectComposer(renderer);
  this.outline=new OutlinePass(new Vector2(1,1),scene,camera);this.outline.enabled=false;this.outline.edgeStrength=0;this.outline.edgeGlow=0;this.outline.visibleEdgeColor.set('#182230');this.outline.hiddenEdgeColor.set('#182230');
  this.pass=new ShaderPass({
   uniforms:{assetMask:{value:null},tDiffuse:{value:null},resolution:{value:new Vector2(1,1)},time:{value:0},underwater:{value:0},dither:{value:0},wobble:{value:0},outline:{value:0},pixelate:{value:1}},
   vertexShader:'varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
   fragmentShader:`
    uniform sampler2D tDiffuse,assetMask;
    uniform vec2 resolution;
    uniform float time,underwater,dither,wobble,outline,pixelate;
    varying vec2 vUv;
    void main(){
     vec2 uv=vUv;
     if(pixelate>1.0)uv=(floor(uv*resolution/pixelate)+0.5)*pixelate/resolution;

     vec3 color=texture2D(tDiffuse,uv).rgb;
     if(outline>0.0){
      float center=texture2D(assetMask,uv).r;
      float surrounding=center;
      for(int x=-4;x<=4;x++){
       for(int y=-4;y<=4;y++){
        if(abs(float(x))<=outline&&abs(float(y))<=outline){
         surrounding=max(surrounding,texture2D(assetMask,uv+vec2(float(x),float(y))/resolution).r);
        }
       }
      }
      float boundary=clamp(surrounding-center,0.0,1.0);
      color=mix(color,vec3(0.0091,0.0160,0.0296),boundary);
     }
     if(underwater>0.0){
      vec3 tint=underwater<1.5?vec3(0.08,0.6,0.65):underwater<2.5?vec3(0.03,0.35,0.55):underwater<3.5?vec3(0.01,0.06,0.23):vec3(0.17,0.23,0.05);
      color=mix(color,tint,0.2+underwater*0.08);
      color+=0.025*sin(uv.x*55.0+sin(uv.y*39.0+time)+time*0.7);
     }
     if(dither>0.0){
      vec2 p=floor(gl_FragCoord.xy);
      float threshold=(mod(p.x,2.0)*2.0+mod(p.y,2.0))/4.0-0.375;
      float intervals=dither-1.0;
      color=floor(clamp(color+threshold/intervals,0.0,1.0)*intervals+0.5)/intervals;
     }
     gl_FragColor=vec4(max(color,vec3(0.0)),1.0);
    }
   `,
  });
  this.pass.uniforms.assetMask!.value=this.outline.renderTargetMaskBuffer.texture;
  this.composer.addPass(new RenderPass(scene,camera));this.composer.addPass(this.outline);this.composer.addPass(this.pass);this.composer.addPass(this.output);
 }
 select(root:Object3D){this.outline.selectedObjects=[root];}
 set(key:Exclude<EffectKey,'wireframe'>,value:string){
  if(!(effectChoices[key] as readonly string[]).includes(value))throw new Error('Unknown viewer effect');
  this.values[key]=value;
  if(key==='outline'){this.outline.enabled=value!=='None';this.outline.edgeThickness=({None:0,Thin1px:1,Medium2px:2,Heavy4px:4} as Record<string,number>)[value]!;}
  const index=(effectChoices[key] as readonly string[]).indexOf(value);
  this.pass.uniforms[key]!.value=key==='pixelate'?[1,2,4,8][index]:key==='outline'?[0,1,2,4][index]:key==='wobble'?[0,0.5,1.5,3][index]:key==='dither'?[0,8,6,4][index]:index;
  this.active=Object.values(this.values).some(v=>v!=='None');
 }
 resize(width:number,height:number){this.composer.setSize(width,height);this.pass.uniforms.resolution!.value.set(width,height);}
 render(){if(!this.active)return false;this.pass.uniforms.time!.value=performance.now()/1000;this.composer.render();return true;}
 dispose(){this.outline.dispose();this.pass.dispose();this.output.dispose();this.composer.dispose();}
}
