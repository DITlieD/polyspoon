import guideUrl from '../../docs/authoring/guide.md?url';
import starterUrl from '../../examples/recipes/starter/README.md?url';
import reviewUrl from '../../docs/contributing/review.md?url';
import agentUrl from '../../docs/authoring/coding-agent.md?url';
import contributionUrl from '../../CONTRIBUTING.md?url';

export function createContributePage() {
  const section=document.createElement('section');section.className='contribute-page';section.hidden=true;
  const heading=document.createElement('h1');heading.textContent='Create and contribute';
  const intro=document.createElement('p');intro.textContent='Start with a preset, or build a procedural recipe with your editor or coding assistant. Use your own agent and keep the resulting source in your project.';
  section.append(heading,intro);
  const steps=[
    ['Read the guide','Learn the parameter, geometry, material and quality contracts before changing a recipe.','Download authoring guide',guideUrl,'authoring-guide.md'],
    ['Start from a working recipe','Use the bench example and scaffold instructions. Register the recipe once so the viewer, CLI and MCP share it.','Download starter instructions',starterUrl,'recipe-starter.md'],
    ['Run the checks','Run typecheck, the current regression suite, recipe validation and neutral renders. Keep the exact configuration and evidence. Technical passes do not replace visual or Unity review.','Download review checklist',reviewUrl,'contribution-review.md'],
    ['Prepare a submission','Presets and executable generators have different review requirements. Include provenance, license scope and tested recipe versions. This local preview has no configured submission destination; keep your patch and evidence together for maintainer review.','Download contribution guide',contributionUrl,'CONTRIBUTING.md'],
  ];
  const list=document.createElement('ol');
  for(const [title,copy,label,url,filename] of steps) {
    const item=document.createElement('li'),h=document.createElement('h2'),p=document.createElement('p'),link=document.createElement('a');
    h.textContent=title!;p.textContent=copy!;link.textContent=label!;link.href=url!;link.download=filename!;item.append(h,p,link);list.append(item);
  }
  const agent=document.createElement('a');agent.href=agentUrl;agent.download='coding-agent.md';agent.textContent='Download coding-agent brief';
  const example=document.createElement('a');example.href='/asset/bench';example.textContent='Customize the timber bench';
  const links=document.createElement('div');links.className='contribute-links';links.append(example,agent);
  section.append(list,links);return section;
}
