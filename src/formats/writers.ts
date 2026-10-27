import type {ReadScene,ReadMesh} from './gltf-read.ts';
const encoder=new TextEncoder();
const num=(value:number)=>{const r=Math.round(value*1e6)/1e6;return Object.is(r,-0)?'0':String(r);};
const safe=(name:string)=>name.replace(/[^A-Za-z0-9_]/g,'_')||'model';

// ---------- OBJ + MTL (meters, +Y up, V flipped to OBJ convention) ----------
export function toObj(scene:ReadScene,name='model'){
 const base=safe(name),obj=['# Polyspoon OBJ export. Units: meters. Up: +Y. Right handed.','mtllib '+base+'.mtl'],mtl=['# Polyspoon MTL export'];
 let vOffset=1,tOffset=1,nOffset=1;
 for(const m of scene.meshes){
  obj.push('o '+m.name);const count=m.positions.length/3;
  for(let i=0;i<count;i++)obj.push('v '+num(m.positions[i*3]!)+' '+num(m.positions[i*3+1]!)+' '+num(m.positions[i*3+2]!));
  if(m.uvs)for(let i=0;i<count;i++)obj.push('vt '+num(m.uvs[i*2]!)+' '+num(1-m.uvs[i*2+1]!));
  if(m.normals)for(let i=0;i<count;i++)obj.push('vn '+num(m.normals[i*3]!)+' '+num(m.normals[i*3+1]!)+' '+num(m.normals[i*3+2]!));
  obj.push('usemtl '+safe(scene.materials[m.material]!.name)+'_'+m.material);
  const ref=(i:number)=>String(vOffset+i)+(m.uvs||m.normals?'/'+(m.uvs?tOffset+i:'')+(m.normals?'/'+(nOffset+i):''):'');
  for(let t=0;t<m.indices.length;t+=3)obj.push('f '+ref(m.indices[t]!)+' '+ref(m.indices[t+1]!)+' '+ref(m.indices[t+2]!));
  vOffset+=count;if(m.uvs)tOffset+=count;if(m.normals)nOffset+=count;
 }
 scene.materials.forEach((mat,i)=>{const [r,g,b,a]=mat.color,ks=num(0.04+0.48*mat.metallic);mtl.push('newmtl '+safe(mat.name)+'_'+i,'Kd '+num(r)+' '+num(g)+' '+num(b),'Ka 0 0 0','Ks '+ks+' '+ks+' '+ks,'Ns '+num(Math.max(1,(1-mat.roughness)*1000)),'d '+num(a),'illum 2','Pr '+num(mat.roughness),'Pm '+num(mat.metallic),...(mat.emissive?['Ke '+mat.emissive.map(num).join(' ')]:[]),'');});
 return {obj:obj.join('\n')+'\n',mtl:mtl.join('\n')+'\n',base};
}
export function toObjZip(scene:ReadScene,name='model'){const {obj,mtl,base}=toObj(scene,name);return storedZip({[base+'.obj']:encoder.encode(obj),[base+'.mtl']:encoder.encode(mtl)});}

// ---------- USDZ (USDA layer, metersPerUnit 1, upAxis Y) ----------
const tuple=(values:Float64Array|number[],size:number,map:(v:number,c:number)=>number=v=>v)=>{const out:string[]=[];for(let i=0;i<values.length;i+=size){const p:string[]=[];for(let c=0;c<size;c++)p.push(num(map(values[i+c]!,c)));out.push('('+p.join(', ')+')');}return '['+out.join(', ')+']';};
export function toUsda(scene:ReadScene,name='model'){
 const root=safe(name).replace(/^([0-9])/,'_$1'),lines=['#usda 1.0','(','    customLayerData = {','        string creator = "Polyspoon"','    }','    defaultPrim = "'+root+'"','    metersPerUnit = 1','    upAxis = "Y"',')','','def Xform "'+root+'" (','    kind = "component"',')','{','    def Scope "Materials"','    {'];
 scene.materials.forEach((mat,i)=>{const id='material_'+i,[r,g,b,a]=mat.color;lines.push('        def Material "'+id+'"','        {','            token outputs:surface.connect = </'+root+'/Materials/'+id+'/PreviewSurface.outputs:surface>','            def Shader "PreviewSurface"','            {','                uniform token info:id = "UsdPreviewSurface"','                color3f inputs:diffuseColor = ('+num(r)+', '+num(g)+', '+num(b)+')','                float inputs:metallic = '+num(mat.metallic),'                float inputs:roughness = '+num(mat.roughness),'                float inputs:opacity = '+num(a),...(mat.emissive?['                color3f inputs:emissiveColor = ('+mat.emissive.map(num).join(', ')+')']:[]),'                token outputs:surface','            }','        }');});
 lines.push('    }');
 for(const m of scene.meshes){
  lines.push('','    def Mesh "'+m.name+'" (','        prepend apiSchemas = ["MaterialBindingAPI"]','    )','    {','        uniform bool doubleSided = '+(scene.materials[m.material]!.doubleSided?'1':'0'),'        int[] faceVertexCounts = ['+new Array(m.indices.length/3).fill(3).join(', ')+']','        int[] faceVertexIndices = ['+Array.from(m.indices).join(', ')+']','        uniform token orientation = "rightHanded"','        point3f[] points = '+tuple(m.positions,3));
  if(m.normals)lines.push('        normal3f[] normals = '+tuple(m.normals,3)+' (','            interpolation = "vertex"','        )');
  if(m.uvs)lines.push('        texCoord2f[] primvars:st = '+tuple(m.uvs,2,(v,c)=>c===1?1-v:v)+' (','            interpolation = "vertex"','        )');
  lines.push('        rel material:binding = </'+root+'/Materials/material_'+m.material+'>','        uniform token subdivisionScheme = "none"','    }');
 }
 lines.push('}','');return lines.join('\n');
}
function crc32(bytes:Uint8Array){let crc=0xffffffff;for(const byte of bytes){crc^=byte;for(let bit=0;bit<8;bit++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return (crc^0xffffffff)>>>0;}
// Stored (uncompressed) zip without timestamps. USDZ requires file data on 64-byte boundaries.
export function storedZip(files:Record<string,Uint8Array>,align=1){
 const locals:Uint8Array[]=[],central:Uint8Array[]=[];let offset=0;
 for(const [name,data] of Object.entries(files)){
  const filename=encoder.encode(name),crc=crc32(data),fixed=30+filename.length,pad=align>1?(align-((offset+fixed+4)%align))%align:0,extraLength=4+pad,header=new Uint8Array(fixed+extraLength),view=new DataView(header.buffer);
  view.setUint32(0,0x04034b50,true);view.setUint16(4,20,true);view.setUint32(14,crc,true);view.setUint32(18,data.length,true);view.setUint32(22,data.length,true);view.setUint16(26,filename.length,true);view.setUint16(28,extraLength,true);header.set(filename,30);view.setUint16(fixed,0x1986,true);view.setUint16(fixed+2,pad,true);
  locals.push(header,data);
  const record=new Uint8Array(46+filename.length),entry=new DataView(record.buffer);
  entry.setUint32(0,0x02014b50,true);entry.setUint16(4,20,true);entry.setUint16(6,20,true);entry.setUint32(16,crc,true);entry.setUint32(20,data.length,true);entry.setUint32(24,data.length,true);entry.setUint16(28,filename.length,true);entry.setUint32(42,offset,true);record.set(filename,46);central.push(record);offset+=header.length+data.length;
 }
 const size=central.reduce((s,r)=>s+r.length,0),end=new Uint8Array(22),view=new DataView(end.buffer);view.setUint32(0,0x06054b50,true);view.setUint16(8,central.length,true);view.setUint16(10,central.length,true);view.setUint32(12,size,true);view.setUint32(16,offset,true);
 const out=new Uint8Array(offset+size+22);let cursor=0;for(const part of [...locals,...central,end]){out.set(part,cursor);cursor+=part.length;}return out;
}
export function toUsdz(scene:ReadScene,name='model'){return storedZip({[safe(name)+'.usda']:encoder.encode(toUsda(scene,name))},64);}

// ---------- Binary FBX 7.4 (UnitScaleFactor 100 => 1 unit = 1 m, +Y up) ----------
type Prop={t:'I';v:number}|{t:'L';v:bigint}|{t:'D';v:number}|{t:'S';v:string}|{t:'C';v:boolean}|{t:'d';v:ArrayLike<number>}|{t:'i';v:ArrayLike<number>};
interface FbxNode{name:string;props:Prop[];children:FbxNode[]}
const I=(v:number):Prop=>({t:'I',v}),L=(v:number|bigint):Prop=>({t:'L',v:BigInt(v)}),D=(v:number):Prop=>({t:'D',v}),S=(v:string):Prop=>({t:'S',v}),C=(v:boolean):Prop=>({t:'C',v}),Da=(v:ArrayLike<number>):Prop=>({t:'d',v}),Ia=(v:ArrayLike<number>):Prop=>({t:'i',v});
const node=(name:string,props:Prop[]=[],children:FbxNode[]=[]):FbxNode=>({name,props,children});
const P=(name:string,type:string,label:string,flags:string,...values:Prop[])=>node('P',[S(name),S(type),S(label),S(flags),...values]);
function propBytes(p:Prop):Uint8Array{
 switch(p.t){
  case 'I':{const b=new Uint8Array(5),v=new DataView(b.buffer);b[0]=73;v.setInt32(1,p.v,true);return b;}
  case 'L':{const b=new Uint8Array(9),v=new DataView(b.buffer);b[0]=76;v.setBigInt64(1,p.v,true);return b;}
  case 'D':{const b=new Uint8Array(9),v=new DataView(b.buffer);b[0]=68;v.setFloat64(1,p.v,true);return b;}
  case 'C':return Uint8Array.of(67,p.v?1:0);
  case 'S':{const s=encoder.encode(p.v),b=new Uint8Array(5+s.length),v=new DataView(b.buffer);b[0]=83;v.setUint32(1,s.length,true);b.set(s,5);return b;}
  case 'd':case 'i':{const width=p.t==='d'?8:4,n=p.v.length,b=new Uint8Array(13+n*width),v=new DataView(b.buffer);b[0]=p.t.charCodeAt(0);v.setUint32(1,n,true);v.setUint32(5,0,true);v.setUint32(9,n*width,true);for(let i=0;i<n;i++){if(p.t==='d')v.setFloat64(13+i*8,p.v[i]!,true);else v.setInt32(13+i*4,p.v[i]!,true);}return b;}
 }
}
function encodeNode(n:FbxNode,start:number):Uint8Array[]{
 const name=encoder.encode(n.name),props=n.props.map(propBytes),propLength=props.reduce((s,b)=>s+b.length,0),headerLength=13+name.length;
 const parts:Uint8Array[]=[];let cursor=start+headerLength+propLength;const childParts:Uint8Array[]=[];
 for(const child of n.children){const encoded=encodeNode(child,cursor);for(const e of encoded){childParts.push(e);cursor+=e.length;}}
 if(n.children.length||!n.props.length){childParts.push(new Uint8Array(13));cursor+=13;}
 const header=new Uint8Array(headerLength),view=new DataView(header.buffer);view.setUint32(0,cursor,true);view.setUint32(4,n.props.length,true);view.setUint32(8,propLength,true);header[12]=name.length;header.set(name,13);
 parts.push(header,...props,...childParts);return parts;
}
function fbxFile(nodes:FbxNode[]){
 const head=new Uint8Array(27);head.set(encoder.encode('Kaydara FBX Binary  '),0);head[20]=0;head[21]=0x1a;head[22]=0;new DataView(head.buffer).setUint32(23,7400,true);
 const parts:Uint8Array[]=[head];let cursor=27;for(const n of nodes)for(const e of encodeNode(n,cursor)){parts.push(e);cursor+=e.length;}
 parts.push(new Uint8Array(13));cursor+=13;
 const footerId=Uint8Array.of(0xfa,0xbc,0xab,0x09,0xd0,0xc8,0xd4,0x66,0xb1,0x76,0xfb,0x83,0x1c,0xf7,0x26,0x7e);parts.push(footerId,new Uint8Array(4));cursor+=20;
 const pad=(16-(cursor%16))%16;parts.push(new Uint8Array(pad));const version=new Uint8Array(4);new DataView(version.buffer).setUint32(0,7400,true);parts.push(version,new Uint8Array(120),Uint8Array.of(0xf8,0x5a,0x8c,0x6a,0xde,0xf5,0xd9,0x7e,0xec,0xe9,0x0c,0xe3,0x75,0x8f,0x29,0x0b));
 const total=parts.reduce((s,p)=>s+p.length,0),out=new Uint8Array(total);let o=0;for(const p of parts){out.set(p,o);o+=p.length;}return out;
}
// One FBX geometry per source node+mesh. Primitives of that mesh become
// polygon groups with ByPolygon material indices (slot order = connection order).
function geometryNode(id:number,parts:ReadMesh[],slots:number[]){
 const m=parts.length===1?parts[0]!:mergeParts(parts),polyMaterial=new Int32Array(m.indices.length/3);
 let t0=0;for(const part of parts){const slot=slots.indexOf(part.material);polyMaterial.fill(slot,t0,t0+part.indices.length/3);t0+=part.indices.length/3;}
 const polygon=new Int32Array(m.indices.length);for(let t=0;t<m.indices.length;t+=3){polygon[t]=m.indices[t]!;polygon[t+1]=m.indices[t+1]!;polygon[t+2]=~m.indices[t+2]!;}
 const children:FbxNode[]=[node('GeometryVersion',[I(124)]),node('Vertices',[Da(m.positions)]),node('PolygonVertexIndex',[Ia(polygon)])],layer:FbxNode[]=[node('Version',[I(100)])];
 if(m.normals){const normals=new Float64Array(m.indices.length*3);for(let k=0;k<m.indices.length;k++)for(let c=0;c<3;c++)normals[k*3+c]=m.normals[m.indices[k]!*3+c]!;children.push(node('LayerElementNormal',[I(0)],[node('Version',[I(101)]),node('Name',[S('')]),node('MappingInformationType',[S('ByPolygonVertex')]),node('ReferenceInformationType',[S('Direct')]),node('Normals',[Da(normals)])]));layer.push(node('LayerElement',[],[node('Type',[S('LayerElementNormal')]),node('TypedIndex',[I(0)])]));}
 if(m.uvs){const uv=new Float64Array(m.uvs.length);for(let i=0;i<m.uvs.length;i+=2){uv[i]=m.uvs[i]!;uv[i+1]=1-m.uvs[i+1]!;}children.push(node('LayerElementUV',[I(0)],[node('Version',[I(101)]),node('Name',[S('UVMap')]),node('MappingInformationType',[S('ByPolygonVertex')]),node('ReferenceInformationType',[S('IndexToDirect')]),node('UV',[Da(uv)]),node('UVIndex',[Ia(m.indices)])]));layer.push(node('LayerElement',[],[node('Type',[S('LayerElementUV')]),node('TypedIndex',[I(0)])]));}
 const single=slots.length===1;
 children.push(node('LayerElementMaterial',[I(0)],[node('Version',[I(101)]),node('Name',[S('')]),node('MappingInformationType',[S(single?'AllSame':'ByPolygon')]),node('ReferenceInformationType',[S('IndexToDirect')]),node('Materials',[Ia(single?[0]:polyMaterial)])]));layer.push(node('LayerElement',[],[node('Type',[S('LayerElementMaterial')]),node('TypedIndex',[I(0)])]));
 children.push(node('Layer',[I(0)],layer));
 return node('Geometry',[L(id),S(m.name+'\x00\x01Geometry'),S('Mesh')],children);
}
function mergeParts(parts:ReadMesh[]):ReadMesh{
 const vertexCount=parts.reduce((s,p)=>s+p.positions.length/3,0),indexCount=parts.reduce((s,p)=>s+p.indices.length,0);
 const positions=new Float64Array(vertexCount*3),normals=parts[0]!.normals?new Float64Array(vertexCount*3):null,uvs=parts[0]!.uvs?new Float64Array(vertexCount*2):null,indices=new Uint32Array(indexCount);
 let v=0,i=0;for(const p of parts){positions.set(p.positions,v*3);if(normals)normals.set(p.normals!,v*3);if(uvs)uvs.set(p.uvs!,v*2);for(const k of p.indices)indices[i++]=k+v;v+=p.positions.length/3;}
 return {name:parts[0]!.name.replace(/_0$/,''),positions,normals,uvs,indices,material:parts[0]!.material};
}
/** Group primitives that came from one node+mesh, when their attribute layouts match. */
function fbxObjects(scene:ReadScene):ReadMesh[][]{
 const groups=new Map<string,ReadMesh[]>(),out:ReadMesh[][]=[];
 for(const m of scene.meshes){
  const key=m.group?m.group+'|'+(m.normals?'n':'')+(m.uvs?'t':''):undefined,list=key?groups.get(key):undefined;
  if(list)list.push(m);else{const fresh=[m];if(key)groups.set(key,fresh);out.push(fresh);}
 }
 return out;
}
export function toFbx(scene:ReadScene){
 let next=1000000;const objects:FbxNode[]=[],connections:FbxNode[]=[],materialIds=new Map<number,number>();
 const settings=node('GlobalSettings',[],[node('Version',[I(1000)]),node('Properties70',[],[P('UpAxis','int','Integer','',I(1)),P('UpAxisSign','int','Integer','',I(1)),P('FrontAxis','int','Integer','',I(2)),P('FrontAxisSign','int','Integer','',I(1)),P('CoordAxis','int','Integer','',I(0)),P('CoordAxisSign','int','Integer','',I(1)),P('OriginalUpAxis','int','Integer','',I(1)),P('OriginalUpAxisSign','int','Integer','',I(1)),P('UnitScaleFactor','double','Number','',D(100)),P('OriginalUnitScaleFactor','double','Number','',D(100))])]);
 scene.materials.forEach((mat,i)=>{if(!scene.meshes.some(m=>m.material===i))return;const id=next++;materialIds.set(i,id);const [r,g,b,a]=mat.color;objects.push(node('Material',[L(id),S(mat.name+'\x00\x01Material'),S('')],[node('Version',[I(102)]),node('ShadingModel',[S('phong')]),node('MultiLayer',[I(0)]),node('Properties70',[],[P('DiffuseColor','Color','','A',D(r),D(g),D(b)),P('Diffuse','Vector3D','Vector','',D(r),D(g),D(b)),P('Opacity','double','Number','',D(a)),P('TransparencyFactor','Number','','A',D(1-a)),P('Shininess','double','Number','',D(Math.max(2,(1-mat.roughness)*100))),P('SpecularColor','Color','','A',D(0.04+0.96*mat.metallic*r),D(0.04+0.96*mat.metallic*g),D(0.04+0.96*mat.metallic*b)),P('ReflectionFactor','double','Number','',D(mat.metallic)),...(mat.emissive?[P('EmissiveColor','Color','','A',D(mat.emissive[0]),D(mat.emissive[1]),D(mat.emissive[2])),P('EmissiveFactor','Number','','A',D(1))]:[])])]));});
 const groups=fbxObjects(scene);
 for(const parts of groups){const m=parts.length>1?{...parts[0]!,name:parts[0]!.name.replace(/_0$/,'')}:parts[0]!,slots=[...new Set(parts.map(p=>p.material))],g=next++,model=next++;objects.push(geometryNode(g,parts,slots),node('Model',[L(model),S(m.name+'\x00\x01Model'),S('Mesh')],[node('Version',[I(232)]),node('Properties70',[],[P('Lcl Translation','Lcl Translation','','A',D(0),D(0),D(0)),P('Lcl Rotation','Lcl Rotation','','A',D(0),D(0),D(0)),P('Lcl Scaling','Lcl Scaling','','A',D(1),D(1),D(1))]),node('Shading',[C(true)]),node('Culling',[S('CullingOff')])]));connections.push(node('C',[S('OO'),L(model),L(0)]),node('C',[S('OO'),L(g),L(model)]),...slots.map(slot=>node('C',[S('OO'),L(materialIds.get(slot)!),L(model)])));}
 const header=node('FBXHeaderExtension',[],[node('FBXHeaderVersion',[I(1003)]),node('FBXVersion',[I(7400)]),node('Creator',[S('Polyspoon')])]);
 const definitions=node('Definitions',[],[node('Version',[I(100)]),node('Count',[I(1+objects.length)]),node('ObjectType',[S('GlobalSettings')],[node('Count',[I(1)])]),node('ObjectType',[S('Geometry')],[node('Count',[I(groups.length)])]),node('ObjectType',[S('Model')],[node('Count',[I(groups.length)])]),node('ObjectType',[S('Material')],[node('Count',[I(materialIds.size)])])]);
 return fbxFile([header,node('FileId',[{t:'S',v:''}]),node('CreationTime',[S('1970-01-01 00:00:00:000')]),node('Creator',[S('Polyspoon')]),settings,node('Documents',[],[node('Count',[I(0)])]),node('References'),definitions,node('Objects',[],objects),node('Connections',[],connections)]);
}
