const unlit='KHR_materials_unlit';
function record(value:unknown):value is Record<string,unknown>{return value!==null&&typeof value==='object'&&!Array.isArray(value);}

export function glbExtensionFailure(document:unknown):string|undefined {
 if(!record(document))return 'unsupported_extension_document';
 const used=document.extensionsUsed??[],required=document.extensionsRequired??[];
 if(document.extensionsUsed===null||document.extensionsRequired===null||!Array.isArray(used)||!Array.isArray(required)||used.some(value=>value!==unlit)||required.some(value=>value!==unlit)||new Set(used).size!==used.length||new Set(required).size!==required.length||required.some(value=>!used.includes(value)))return 'unsupported_extension_declaration';
 let placements=0,nodes=0;
 function inspect(value:unknown,path:readonly(string|number)[],depth:number):string|undefined {
  if(value===null||typeof value!=='object')return;
  if(++nodes>200000||depth>64)return 'unsupported_extension_structure';
  if(Array.isArray(value)){
   for(let i=0;i<value.length;i++){const failure=inspect(value[i],[...path,i],depth+1);if(failure)return failure;}
   return;
  }
  for(const [key,child] of Object.entries(value)){
   if(key==='extras')continue;
   if(key==='extensions'){
    if(path.length!==2||path[0]!=='materials'||typeof path[1]!=='number')return 'unsupported_extension_placement';
    if(!record(child)||Object.keys(child).length!==1||!Object.hasOwn(child,unlit)||!record(child[unlit])||Object.keys(child[unlit]).length)return 'unsupported_extension_payload';
    placements++;continue;
   }
   const failure=inspect(child,[...path,key],depth+1);if(failure)return failure;
  }
 }
 const failure=inspect(document,[],0);
 if(failure)return failure;
 if((placements>0)!==used.includes(unlit))return 'unsupported_extension_declaration';
}
