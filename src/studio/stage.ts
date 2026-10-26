import { EdgesGeometry, Group, LineSegments, LineBasicMaterial, AmbientLight, Box3Helper, Color, Raycaster, Vector2, DirectionalLight, HemisphereLight, Mesh, MeshBasicMaterial, MeshStandardMaterial, OrthographicCamera, PlaneGeometry, Scene, ShadowMaterial, SRGBColorSpace, NoToneMapping, PCFShadowMap, Vector3, WebGLRenderer } from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { Preview } from '../catalog/index.ts';
import { corners, fitBounds } from './framing.ts';
import { ViewerEffects } from './effects.ts';
import type { EffectKey } from './effects.ts';

export type View = 'front' | 'rear' | 'left' | 'right' | 'top' | 'oblique' | 'rear-oblique';
export type Mode = 'shaded' | 'clay' | 'silhouette' | 'color';
export class Stage {
  readonly renderer: WebGLRenderer;
  readonly scene = new Scene();
  readonly camera = new OrthographicCamera(-1,1,1,-1,0.01,100);
  readonly orbit: OrbitControls;
  private readonly ground: Mesh;
  private readonly resizeObserver: ResizeObserver;
  private readonly key = new DirectionalLight(0xfffaf0, 2.3);
  private readonly fill = new DirectionalLight(0xf2f7ff, 0.7);
  private readonly clay = new MeshStandardMaterial({ color: '#babbb7', roughness: 0.85 });
  private readonly silhouette = new MeshBasicMaterial({ color: '#172119' });
  private readonly colorMaterials: MeshBasicMaterial[] = [];
  private readonly originalMaterials = new WeakMap<Mesh,{key:string;material:MeshStandardMaterial|MeshBasicMaterial}>();
  private build?: Preview;
  private effects:ViewerEffects;
  private lines?:Group;
  private wireMode='None';
  private wobble='None';
  private previewMaterials:Array<MeshStandardMaterial|MeshBasicMaterial>=[];
  private readonly viewportSize=new Vector2(1,1);
  private background='#e6e8e3';
  private selection?: Box3Helper;
  private selectedRole?: string;
  onPick?: (role: string,part:string) => void;
  private pointerStart?: { x: number; y: number; moved: boolean };
  private fixedSpan?: number;
  private diagnostic = false;
  private framePadding = 1.3;
  private mode: Mode = 'shaded';
  constructor(private readonly host: HTMLElement) {
    this.renderer = new WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = SRGBColorSpace; this.renderer.toneMapping = NoToneMapping;
    this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = PCFShadowMap;
    host.append(this.renderer.domElement);
    this.renderer.domElement.setAttribute('aria-label', '3D asset. Drag to orbit and scroll to zoom.');
    this.scene.background = new Color('#e6e8e3');
    this.scene.add(new HemisphereLight(0xffffff, 0xb6bdb0, 1.6), new AmbientLight(0xffffff, 0.25));
    this.key.castShadow = true; this.key.shadow.mapSize.set(2048,2048);
    this.key.shadow.intensity = 0.35; this.key.shadow.radius = 3;
    this.key.shadow.bias = -0.0001;
    this.scene.add(this.key, this.key.target, this.fill, this.fill.target);
    this.ground = new Mesh(new PlaneGeometry(1,1), new ShadowMaterial({ color: '#536050', opacity: 0.45 }));
    this.ground.name = 'stage'; this.ground.rotation.x = -Math.PI / 2;
    this.ground.receiveShadow = true; this.scene.add(this.ground);
    this.effects=new ViewerEffects(this.renderer,this.scene,this.camera);
    this.orbit = new OrbitControls(this.camera, this.renderer.domElement);
    this.renderer.domElement.addEventListener('pointerdown', event => {
      if(event.button===0) this.pointerStart={x:event.clientX,y:event.clientY,moved:false};
    });
    this.renderer.domElement.addEventListener('pointermove',event=>{
      if(this.pointerStart && Math.hypot(event.clientX-this.pointerStart.x,event.clientY-this.pointerStart.y)>5) this.pointerStart.moved=true;
    });
    this.renderer.domElement.addEventListener('pointerup',event=>{
      const start=this.pointerStart; this.pointerStart=undefined;
      if(!start || start.moved || event.button!==0 || !this.build) return;
      const rect=this.renderer.domElement.getBoundingClientRect(), ray=new Raycaster();
      ray.setFromCamera(new Vector2((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1),this.camera);
      const hit=ray.intersectObject(this.build.root,true).find(h=>h.object.visible && h.object instanceof Mesh && typeof h.object.userData.materialRole==='string');
      if(hit) this.onPick?.(hit.object.userData.materialRole,hit.object.name);
    });
    this.renderer.domElement.addEventListener('pointercancel',()=>{this.pointerStart=undefined;});
    this.orbit.enableDamping = true; this.orbit.dampingFactor = 0.08;
    this.orbit.minZoom = 0.5; this.orbit.maxZoom = 5;
    this.orbit.maxPolarAngle = Math.PI * 0.495;
    this.resizeObserver = new ResizeObserver(() => this.resize()); this.resizeObserver.observe(host);
    this.renderer.setAnimationLoop(() => { this.orbit.update(); this.render(); });
  }
  replace(build: Preview, frame = true): void {
    if (this.build) this.scene.remove(this.build.root);
    this.build = build; this.scene.add(build.root);this.effects.select(build.root);
    this.setMode(this.mode);
    const center = build.bounds.getCenter(new Vector3()), size = Math.max(build.dimensions.length(), 0.1);
    this.ground.position.set(center.x, build.bounds.min.y - size * 0.0005, center.z);
    this.ground.scale.setScalar(size * 20);
    this.key.position.copy(center).addScaledVector(new Vector3(-2,5,3).normalize(), size * 2);
    this.key.target.position.copy(center);
    this.fill.position.copy(center).addScaledVector(new Vector3(3,2,-3).normalize(), size * 2);
    this.fill.target.position.copy(center);
    const shadow = this.key.shadow.camera;
    shadow.left = -size; shadow.right = size; shadow.top = size; shadow.bottom = -size;
    shadow.near = size * 0.1; shadow.far = size * 4; shadow.updateProjectionMatrix();
    this.key.shadow.normalBias = size * 0.001;
    if(frame) this.setView();
    else { this.updateClipping(); this.render(); }
    this.selectRole(this.selectedRole);
    this.setWireMode(this.wireMode);
  }
  setView(view: View = 'oblique', span?: number): void {
    if (!this.build) return;
    this.fixedSpan = span;
    const center = this.build.bounds.getCenter(new Vector3()), size = Math.max(this.build.dimensions.length(), 0.1);
    const directions: Record<View, [number,number,number]> = { front:[0,0,1], rear:[0,0,-1], left:[-1,0,0], right:[1,0,0], top:[0,1,0.00001], oblique:[2.7,1.85,3.5], 'rear-oblique':[-2.7,1.85,-3.5] };
    this.camera.up.set(0,1,0);
    this.camera.position.copy(center).addScaledVector(new Vector3(...directions[view]).normalize(), size * 3);
    this.orbit.target.copy(center); this.camera.lookAt(center); this.camera.zoom = 1;
    this.orbit.maxPolarAngle = this.diagnostic ? Math.PI : Math.PI * 0.495;
    this.orbit.update(); this.resize();
  }
  selectRole(role?: string) {
    if(this.selection) {
      this.scene.remove(this.selection); this.selection.geometry.dispose();
      (this.selection.material as MeshBasicMaterial).dispose(); this.selection=undefined;
    }
    this.selectedRole=role;
    if(!role || !this.build) return;
    const bounds=this.build.bounds.clone().makeEmpty();
    this.build.root.traverse(object=>{
      if(object instanceof Mesh && object.userData.materialRole===role) bounds.expandByObject(object,true);
    });
    if(bounds.isEmpty()) return;
    this.selection=new Box3Helper(bounds,0x318562);
    (this.selection.material as MeshBasicMaterial).depthTest=false;
    this.selection.renderOrder=10; this.scene.add(this.selection); this.render();
  }
  private updateClipping() {
    if(!this.build) return;
    this.camera.updateMatrixWorld(true);
    const points=corners(this.build.bounds).map(p=>p.applyMatrix4(this.camera.matrixWorldInverse));
    const diagonal=Math.max(this.build.dimensions.length(),0.1);
    this.camera.near=Math.max(0.001,-Math.max(...points.map(p=>p.z))-diagonal);
    this.camera.far=Math.max(this.camera.near+diagonal,-Math.min(...points.map(p=>p.z))+diagonal);
    this.camera.updateProjectionMatrix();
  }
  cameraState() { return { position:this.camera.position.toArray(),target:this.orbit.target.toArray(),zoom:this.camera.zoom,left:this.camera.left,right:this.camera.right,top:this.camera.top,bottom:this.camera.bottom }; }
  setDiagnostic(enabled: boolean) {
    this.diagnostic = enabled; this.orbit.enabled = !enabled; this.ground.visible = !enabled; this.resize();
  }
  setMode(mode: Mode) {
    this.mode = mode;
    for(const material of this.previewMaterials??[])material.dispose();
    this.previewMaterials=[];
    this.scene.overrideMaterial = mode === 'clay' ? this.clay : mode === 'silhouette' ? this.silhouette : null;
    this.scene.background = new Color(mode === 'silhouette' ? '#ffffff' : this.background??'#e6e8e3');
    for (const m of this.colorMaterials) m.dispose();
    this.colorMaterials.length = 0;
    this.build?.root.traverse(object => {
      if (!(object instanceof Mesh)) return;
      let original=this.originalMaterials.get(object);
      if(!original){
        const entry=Object.entries(this.build!.materials).find(([,material])=>material===object.material);
        if(!entry)throw new Error('Unregistered authored material on '+object.name);
        original={key:entry[0],material:entry[1]};
        this.originalMaterials.set(object,original);
      }
      const material=original.material;
      if (mode === 'color') {
        const next = new MeshBasicMaterial({ color: material.color,wireframe:material.wireframe,vertexColors:material.vertexColors });
        this.colorMaterials.push(next); object.material = next;
      } else object.material = material;
    });
    this.applyWobble();
    this.render();
  }
  setBackground(color:string){this.background=color;this.setMode(this.mode);}
  setEffect(key:EffectKey,value:string){
    if(key==='wireframe')this.setWireMode(value);
    else if(key==='wobble'){this.wobble=value;this.setMode(this.mode);}
    else this.effects.set(key,value);
    this.render();
  }
  private applyWobble(){
    const pixels=({None:0,Subtle:1,Wobble:3,PS1:6} as Record<string,number>)[this.wobble]??0;
    if(!pixels)return;
    const cache=new Map<MeshStandardMaterial|MeshBasicMaterial,MeshStandardMaterial|MeshBasicMaterial>();
    this.build?.root.traverse(object=>{
      if(!(object instanceof Mesh))return;
      const original=object.material as MeshStandardMaterial|MeshBasicMaterial;
      let material=cache.get(original);
      if(!material){
        material=original.clone();
        material.onBeforeCompile=shader=>{
          shader.uniforms.previewViewport={value:this.viewportSize};
          shader.uniforms.previewGrid={value:pixels};
          shader.vertexShader='uniform vec2 previewViewport; uniform float previewGrid;\n'+shader.vertexShader;
          shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>','#include <project_vertex>\nvec2 snapped=floor((gl_Position.xy/gl_Position.w*0.5+0.5)*previewViewport/previewGrid+0.5)*previewGrid/previewViewport; gl_Position.xy=(snapped*2.0-1.0)*gl_Position.w;');
        };
        material.customProgramCacheKey=()=> 'preview-snap-'+pixels;
        cache.set(original,material);this.previewMaterials.push(material);
      }
      object.material=material;
    });
  }
  private clearLines(){
    if(!this.lines)return;
    this.scene.remove(this.lines);
    this.lines.traverse(object=>{if(object instanceof LineSegments){object.geometry.dispose();(object.material as LineBasicMaterial).dispose();}});
    this.lines=undefined;
  }
  setWireMode(value:string){
    if(!['None','Creases','Mesh','Ghost'].includes(value))throw new Error('Unknown wireframe mode');
    this.wireMode=value;this.clearLines();
    if(this.build)for(const material of Object.values(this.build.materials))material.wireframe=value==='Mesh';
    for(const material of [...this.colorMaterials,...this.previewMaterials])material.wireframe=value==='Mesh';
    if(this.build&&(value==='Creases'||value==='Ghost')){
      this.lines=new Group();this.build.root.updateMatrixWorld(true);
      this.build.root.traverse(object=>{
        if(!(object instanceof Mesh)||!object.visible)return;
        const line=new LineSegments(new EdgesGeometry(object.geometry,25),new LineBasicMaterial({color:0x233148,transparent:true,opacity:value==='Ghost'?0.3:0.8,depthTest:value!=='Ghost'}));
        line.matrixAutoUpdate=false;line.matrix.copy(object.matrixWorld);line.renderOrder=3;this.lines!.add(line);
      });
      this.scene.add(this.lines);
    }
    this.render();
  }
  refreshVisibility(){this.setWireMode(this.wireMode);}
  setWireframe(enabled:boolean){this.setWireMode(enabled?'Mesh':'None');}
  setFramePadding(value:number) {
    if(!Number.isFinite(value)||value<1.1||value>2)throw new Error('Invalid frame padding');
    this.framePadding=value;this.resize();
  }
  resize() {
    const width = Math.max(this.host.clientWidth,1), height = Math.max(this.host.clientHeight,1);
    if (this.build) fitBounds(this.camera, this.build.bounds, width / height, this.diagnostic ? 1.32 : this.framePadding, this.fixedSpan);
    this.viewportSize.set(width,height);
    this.renderer.setSize(width,height); this.effects.resize(width,height); this.render();
  }
  projectedBounds() {
    this.camera.updateMatrixWorld(true);
    return this.build ? corners(this.build.bounds).map(p => p.project(this.camera).toArray()) : [];
  }
  render() { if(!this.effects?.render())this.renderer.render(this.scene,this.camera); }
  dispose() {
    this.selectRole(undefined);
    this.clearLines();this.effects.dispose();
    for(const material of this.previewMaterials)material.dispose();
    this.renderer.setAnimationLoop(null); this.resizeObserver.disconnect(); this.orbit.dispose();
    this.ground.geometry.dispose(); (this.ground.material as MeshStandardMaterial).dispose();
    this.clay.dispose(); this.silhouette.dispose();
    for (const m of this.colorMaterials) m.dispose();
    this.key.shadow.map?.dispose();
    this.renderer.dispose(); this.renderer.domElement.remove();
  }
}
