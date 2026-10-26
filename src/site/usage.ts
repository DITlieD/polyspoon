import type { Design } from '../catalog/index.ts';

export function usageContent(design:Design) {
 const filename=design.family+'.glb';
 return {
  glb:{
   description:'Export GLB above, then put '+filename+' alongside your web assets. This example assumes an existing Three.js scene. In Unity with glTFast installed, copy the GLB into Assets and drag its imported prefab into your scene. Dimensions are in meters; preview-only hidden parts are included.',
   snippets:[{label:'Three.js',text:"import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';\n\nconst model = await new GLTFLoader().loadAsync('./"+filename+"');\nscene.add(model.scene);"}],
  },
  design:{
   description:'Save this versioned design JSON, then load it in the studio or export it with the existing repository CLI. Run the command from the repository root with its dependencies already available. CLI output replaces an existing file at the chosen path.',
   snippets:[{label:'Current design JSON',text:JSON.stringify(design,null,2)},
    {label:'Local CLI',text:'node_modules/.bin/tsx scripts/cli.ts export --config '+design.family+'.design.json --out exports/'+filename}],
  },
  agent:{
   description:'Use these tool calls with the configured local Polyspoon MCP server. Parameters are the current requested values. export_asset writes to the server’s configured output directory and rejects an existing filename.',
   snippets:[{label:'MCP tool calls',text:JSON.stringify([
    {name:'get_asset',arguments:{family:design.family}},
    {name:'build_variant',arguments:{family:design.family,parameters:design.requested,...(design.appearance?{appearance:design.appearance}:{})}},
    {name:'export_asset',arguments:{family:design.family,parameters:design.requested,...(design.appearance?{appearance:design.appearance}:{}),filename}},
   ],null,2)}],
  },
 };
}

export function mountUsage(host:HTMLElement,configuration:()=>Design,currentDesignReady:()=>boolean=()=>true) {
 const section=document.createElement('section');section.className='usage-panel';section.id='asset-usage';
 const title=document.createElement('h2');title.textContent='Use it in your project';
 const tabs=document.createElement('div');tabs.className='usage-tabs';tabs.setAttribute('aria-label','Usage format');
 const description=document.createElement('p'),body=document.createElement('div');
 const status=document.createElement('p');status.className='usage-status';status.setAttribute('role','status');
 let active:keyof ReturnType<typeof usageContent>='glb',signature='',revision=0;
 for(const [id,label] of [['glb','GLB'],['design','Saved design'],['agent','AI agent']] as const){
  const button=document.createElement('button');button.textContent=label;button.dataset.usage=id;
  button.addEventListener('click',()=>{active=id;signature='';refresh();});tabs.append(button);
 }
 section.append(title,tabs,description,body,status);host.append(section);
 function refresh(){
  const ready=currentDesignReady(),content=usageContent(configuration())[active],next=JSON.stringify({active,content,ready});
  if(next===signature)return;signature=next;revision++;status.textContent='';
  for(const button of tabs.querySelectorAll('button'))button.setAttribute('aria-pressed',String(button.dataset.usage===active));
  description.textContent=content.description;body.replaceChildren();
  if(active!=='glb'&&!ready){
   description.textContent='Current design output is unavailable while an edit is pending or invalid.';
   const unavailable=document.createElement('p');unavailable.className='usage-unavailable';unavailable.setAttribute('role','status');unavailable.textContent='An edit is pending or invalid. Return to the edited field, then correct the value or press Escape to restore its validated value. Current snippets and copy actions will return when the design is ready.';body.append(unavailable);return;
  }
  for(const snippet of content.snippets){
   const block=document.createElement('div');block.className='usage-snippet';
   const heading=document.createElement('div'),label=document.createElement('label'),copy=document.createElement('button');
   const text=document.createElement('textarea');text.readOnly=true;text.value=snippet.text;text.spellcheck=false;
   text.id='usage-'+active+'-'+body.children.length;text.rows=Math.min(12,snippet.text.split('\n').length+1);
   label.htmlFor=text.id;label.textContent=snippet.label;copy.textContent='Copy';copy.setAttribute('aria-label','Copy '+snippet.label);
   copy.addEventListener('click',async()=>{
    if(active!=='glb'&&!currentDesignReady()){signature='';refresh();return;}
    const ticket=revision,value=text.value;
    try{await navigator.clipboard.writeText(value);if(ticket===revision)status.textContent=snippet.label+' copied.';}
    catch{if(ticket===revision){text.focus();text.select();status.textContent='Clipboard unavailable. Text selected; use your keyboard to copy.';}}
   });
   heading.append(label,copy);block.append(heading,text);body.append(block);
  }
 }
 refresh();return {refresh,element:section};
}
