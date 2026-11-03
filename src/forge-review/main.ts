// Local review browser for Asset Forge candidates: list, filter and inspect every live candidate in 3D.
// Read-only. Acceptance still happens through the human review queue on the site.
import '../../hosted/shared/style.css';
import '../../hosted/app/live-queue.css';
import './forge-review.css';
type Candidate={id:string;family:string;path:string;triangles:number|null;glbSha256:string;status:string;preReview:string;fixNote?:string;replaces?:string};
const el=<K extends keyof HTMLElementTagNameMap>(tag:K,cls='',...kids:Array<Node|string>)=>{const n=document.createElement(tag);n.className=cls;n.append(...kids);return n;};
const rel=(p:string)=>'/'+p.replace(/^forge-out\//,'forge-out/');
async function main(){
 const index=await (await fetch('/forge-out/candidates-index.json')).json() as {live:Candidate[];generatedAt?:string};
 const live=index.live,families=[...new Set(live.map(c=>c.family))].sort();
 const search=el('input');search.type='search';search.placeholder='Search by name or family';search.setAttribute('aria-label','Search candidates');
 const family=el('select');family.setAttribute('aria-label','Family');family.append(el('option','','All families ('+families.length+')'),...families.map(f=>{const o=el('option','',f);o.value=f;return o;}));(family.firstChild as HTMLOptionElement).value='';
 const list=el('div','live-queue-list'),detail=el('section','queue-detail',el('h2','','Pick a candidate'),el('p','muted','Select a model on the left to open it in the 3D viewer. Use J / K to move through the list.'));
 const count=el('p','muted');
 let dispose:(()=>void)|undefined,shown:Candidate[]=[],current=-1;
 const glbFor=async(c:Candidate)=>{const m=await fetch('/forge-glb'+rel(c.path));if(m.ok)return m;throw new Error('GLB not found for '+c.id);};
 const open=async(i:number)=>{
  const c=shown[i];if(!c)return;current=i;for(const [k,row] of [...list.children].entries())row.setAttribute('aria-current',String(k===i));(list.children[i] as HTMLElement)?.scrollIntoView({block:'nearest'});
  dispose?.();dispose=undefined;const viewer=el('div','queue-viewer'),status=el('p','status','Loading model…');
  const name=c.path.split('/').pop()!;const meta=el('p','muted',[c.family,(c.triangles!=null?c.triangles.toLocaleString()+' triangles':'triangles: see viewer'),c.preReview==='recommend-accept'?'reviewer bot: recommend accept':'reviewer bot: '+c.preReview].join(' · '));
  detail.replaceChildren(el('h2','',name),meta,...(c.fixNote?[el('p','muted',c.fixNote)]:[]),viewer,status,el('p','asset-path',c.id+' · sha256 '+c.glbSha256.slice(0,16)+'…'));
  try{const bytes=new Uint8Array(await (await glbFor(c)).arrayBuffer());const {mountViewer}=await import('../../hosted/app/queue-viewer.ts');if(current!==i)return;dispose=await mountViewer(viewer,bytes);status.textContent='';}
  catch(error){status.textContent=String((error as Error).message??error);status.classList.add('error');}
 };
 const render=()=>{
  const q=search.value.trim().toLowerCase();shown=live.filter(c=>(!family.value||c.family===family.value)&&(!q||c.id.toLowerCase().includes(q)));
  count.textContent=shown.length+' of '+live.length+' candidates';
  list.replaceChildren(...shown.map((c,i)=>{const row=el('button','queue-row');row.type='button';const thumb=el('img');thumb.loading='lazy';thumb.alt='';thumb.src=rel(c.path)+'/renders/selected-oblique.png';thumb.addEventListener('error',()=>thumb.replaceWith(el('span')),{once:true});
   row.append(el('div','queue-thumbs forge-thumb',thumb),el('div','',el('h3','',c.path.split('/').pop()!),el('div','queue-meta',el('span','',c.family),el('span','',(c.triangles!=null?c.triangles.toLocaleString()+' tris':'rigged')),el('span','queue-badge '+(c.preReview==='recommend-accept'?'info':'warning'),c.preReview==='recommend-accept'?'bot: accept':c.preReview))));
   row.addEventListener('click',()=>void open(i));return row;}));
 };
 search.addEventListener('input',render);family.addEventListener('change',render);
 document.addEventListener('keydown',e=>{if((e.target as HTMLElement).closest('input,select,textarea,canvas'))return;if(e.key==='j'&&current<shown.length-1)void open(current+1);if(e.key==='k'&&current>0)void open(current-1);});
 const main=el('main','page forge-review',el('div','page-heading',el('p','eyebrow','Local review · not published'),el('h1','','Asset Forge candidates'),el('p','muted','Every live candidate from forge-out, loaded straight from its GLB. Inspecting here approves nothing: accept or reject models through the human review queue.')),el('div','search',search,family),count,el('div','live-queue',list,detail));
 document.body.className='member-site';document.body.replaceChildren(main);render();if(shown.length)void open(0);
}
main().catch(error=>{document.body.textContent='Could not load forge-out/candidates-index.json: '+String(error);});
