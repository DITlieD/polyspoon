import {brandArtwork} from './brand.ts';
import {createAgentSetup} from './docs.ts';
import './identity.css';
import guideUrl from '../../docs/authoring/guide.md?url';
import agentUrl from '../../docs/authoring/coding-agent.md?url';
import reviewUrl from '../../docs/contributing/review.md?url';

function page(className:string,html:string){const main=document.createElement('main');main.className=className;main.hidden=true;main.innerHTML=html;return main;}
export function createLandingPage(){
 return page('landing-page',`
 <section class="landing-hero">
  <div class="hero-copy"><p class="entry-eyebrow">A little spoon. A lot to make.</p><h1>3D models, made<br>to be remade.</h1><p class="hero-description">Give your own agent the Polyspoon bundle and a request. Customize an existing model or author a recipe, then keep the editable source and export it to your project.</p><div class="entry-actions"><a class="blue-action" data-catalog-link href="/catalog">Open preview catalog <span aria-hidden="true">↗</span></a><a class="quiet-action" href="/docs">Set up your agent <span aria-hidden="true">↗</span></a></div><p class="preview-note">Local preview · Your agent, your editor, your files.</p></div>
  <figure class="hero-figure"><img src="/brand/courtyard.png" width="1440" height="960" alt="An editable timber cottage with a leafy tree, courtyard fences, crate, lantern and stone"><figcaption>Built from editable Polyspoon models.</figcaption></figure>
 </section>
 <section class="workflow-section" aria-labelledby="workflow-heading"><div class="workflow-intro"><p class="entry-eyebrow">FROM A REQUEST TO YOUR PROJECT</p><h2 id="workflow-heading">Bring an idea.<br>Keep the recipe.</h2><p>Work with the agent you already use. One installable bundle gives it the local engine, model contracts and checks to run.</p></div><ol class="workflow-steps"><li><span class="step-number">01</span><h3>Set up your agent</h3><p>Copy the setup request for your app. Then describe the model, its proportions and how it should change.</p></li><li><span class="step-number">02</span><h3>Make it your own</h3><p>Adjust a current model in the preview, or have your agent author a procedural recipe with supported controls.</p></li><li><span class="step-number">03</span><h3>Take the source with you</h3><p>Save the editable design. Export a GLB for your project, and keep the recipe source or procedural module for later changes.</p></li></ol></section>
 <section class="entry-bottom"><h2>Something to start with.</h2><p>Explore the current models and their presets. Change the construction before you download.</p><a class="blue-action" data-catalog-link href="/catalog">Explore the models <span aria-hidden="true">↗</span></a></section>`);
}
export function createDocsPage(){
 const main=page('docs-page',`<header class="docs-intro"><p class="entry-eyebrow">POLYSPOON DOCUMENTATION</p><h1>Give your agent<br>a good starting point.</h1><p>Give your agent one setup request and your model idea. The bundle installs a project skill and supplies a local engine; the guides below are optional references.</p></header><div class="docs-grid"></div><section class="docs-workflow"><h2>Choose your starting point</h2><p>For an existing model, open the preview catalog, adjust its supported controls and save the design. Use that saved design when asking your agent for the next change.</p><p>For a new model, ask your agent to read the authoring guide, use a current working recipe as a reference and run the listed checks. Keep the recipe, license information and reproducible inputs with your source.</p><a class="quiet-action" data-catalog-link href="/catalog">Open preview catalog ↗</a><a class="quiet-action" href="/contribute">Create and contribute ↗</a></section><section class="access-note"><h2>Local preview and hosted access</h2><p>This local preview is open. Hosted catalog and model access must require sign-in before deployment. The account service belongs to the future hosted release and is not enforced here.</p><p>polyspoon.com is the owned domain for Polyspoon. It is not a live service yet. Use the links on this local site to explore the toolkit.</p></section>`);
 const grid=main.querySelector('.docs-grid')!;
 grid.before(createAgentSetup());
 for(const [title,copy,label,url,filename] of [
  ['Agent reference','Optional workflow and boundaries for your coding agent after bundle setup.','Download optional brief',agentUrl,'coding-agent.md'],
  ['Author a recipe','The model, parameter, construction and delivery contracts, with a working path through the toolkit.','Download authoring guide',guideUrl,'authoring-guide.md'],
  ['Check the result','Technical validation and visual review have separate roles. Keep reproducible inputs and review the actual model.','Download review checklist',reviewUrl,'contribution-review.md'],
 ]){const article=document.createElement('article'),h=document.createElement('h2'),p=document.createElement('p'),a=document.createElement('a');h.textContent=title!;p.textContent=copy!;a.textContent=label!;a.href=url!;a.download=filename!;article.append(h,p,a);grid.append(article);}
 return main;
}
export function createFooter(){
 const footer=document.createElement('footer');footer.className='site-footer';
 const brand=document.createElement('a');brand.className='footer-brand';brand.href='/';brand.setAttribute('aria-label','Polyspoon home');brand.append(brandArtwork());
 const domain=document.createElement('span');domain.className='footer-domain';domain.textContent='polyspoon.com · Local preview';
 const nav=document.createElement('nav');nav.setAttribute('aria-label','Footer');for(const [label,path] of [['Models','/catalog'],['Docs','/docs'],['Contribute','/contribute']]){const a=document.createElement('a');a.textContent=label!;a.href=path!;if(path==='/catalog')a.dataset.catalogLink='';nav.append(a);}
 footer.append(brand,domain,nav);return footer;
}
