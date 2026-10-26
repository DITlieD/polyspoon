import type { Control, Descriptor, Design } from '../catalog/index.ts';
import type { ParameterIssue } from '../engine/parameters.ts';
import { paletteMatches } from '../engine/parameters.ts';

export function readableRegion(label:string):string {
  const words=label.replace(/([a-z])([A-Z])/g,'$1 $2').replace(/[_-]+/g,' ');
  return words.charAt(0).toUpperCase()+words.slice(1).toLowerCase();
}

interface Actions {
  change(key:string,value:unknown):boolean;
  reset(key:string):void;
  palette(id:string):void;
  begin():void;
  end():void;
  pending(key:string,active:boolean):void;
  select(role:string):void;
}
interface Field { control:Control; wrapper:HTMLElement; input:HTMLInputElement|HTMLSelectElement; slider?:HTMLInputElement; picker?:HTMLInputElement; output?:HTMLOutputElement; reset:HTMLButtonElement; error:HTMLElement; hint:HTMLElement; details:HTMLElement; status:HTMLElement }
export class ControlPanel {
  private fields=new Map<string,Field>();
  private palettes:HTMLButtonElement[]=[];
  private group='shape';
  constructor(private host:HTMLElement,private actions:Actions) {}
  mount(d:Descriptor) {
    this.fields.clear();this.palettes=[];this.host.replaceChildren();
    const paletteGroup=document.createElement('div');paletteGroup.className='palettes';paletteGroup.dataset.group='colors';
    for(const palette of d.palettes) {
      const button=document.createElement('button');button.className='colorway';button.dataset.colorway=palette.id;
      const swatches=document.createElement('span');swatches.className='swatches';swatches.setAttribute('aria-hidden','true');
      for(const color of palette.colors){const chip=document.createElement('i');chip.style.setProperty('--paint',color);swatches.append(chip);}
      const name=document.createElement('span');name.textContent=palette.label;button.append(swatches,name);
      button.addEventListener('click',()=>this.actions.palette(palette.id));paletteGroup.append(button);this.palettes.push(button);
    }
    this.host.append(paletteGroup);
    const shownHints=new Set<string>();
    for(const c of d.controls) {
      if(c.key==='colorway') continue;
      const displayLabel=c.kind==='color'?readableRegion(c.label):c.label;
      const wrapper=document.createElement('div');wrapper.className='parameter';wrapper.dataset.key=c.key;wrapper.dataset.group=c.group;
      const heading=document.createElement('div');heading.className='parameter-heading';
      const label=document.createElement('label');label.htmlFor=c.key;label.textContent=displayLabel;
      if(c.kind==='color') {
        const select=document.createElement('button');select.className='region-name';select.textContent=displayLabel;
        select.setAttribute('aria-label','Select all '+displayLabel+' pieces');select.addEventListener('click',()=>this.actions.select(c.role));heading.append(select);
        label.className='sr-only';heading.append(label);
      } else heading.append(label);
      const status=document.createElement('span');status.className='control-state';heading.append(status);
      const reset=document.createElement('button');reset.className='control-reset';reset.textContent='↺';reset.title='Reset '+displayLabel;reset.setAttribute('aria-label','Reset '+displayLabel);
      reset.addEventListener('click',()=>this.actions.reset(c.key));heading.append(reset);wrapper.append(heading);
      const details=document.createElement('p');details.className='control-details';
      const error=document.createElement('p');error.className='field-error';error.id=c.key+'-error';
      const hint=document.createElement('p');hint.className='hint';hint.textContent=c.kind==='color'?'Applies to all '+displayLabel.toLowerCase()+' pieces.':c.hint;hint.id=c.key+'-hint';
      const hintIdentity=c.group+':'+hint.textContent;
      if(c.kind!=='color'&&shownHints.has(hintIdentity))hint.classList.add('sr-only');
      shownHints.add(hintIdentity);
      let input:HTMLInputElement|HTMLSelectElement,slider:HTMLInputElement|undefined,picker:HTMLInputElement|undefined,output:HTMLOutputElement|undefined;
      if(c.kind==='range'||c.kind==='integer') {
        const row=document.createElement('div');row.className='numeric-row';
        const factor=c.unit==='cm'?100:1;
        if(c.unit!=='seed') {
          slider=document.createElement('input');slider.type='range';slider.id=c.key+'-slider';slider.min=String(c.min);slider.max=String(c.max);slider.step=String(c.step);
          slider.setAttribute('aria-label',displayLabel+' slider');
          slider.addEventListener('pointerdown',()=>this.actions.begin());
          slider.addEventListener('keydown',event=>{if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End','PageUp','PageDown'].includes(event.key))this.actions.begin();});
          slider.addEventListener('input',()=>this.actions.change(c.key,slider!.valueAsNumber));
          for(const event of ['change','pointerup','pointercancel','keyup','blur']) slider.addEventListener(event,()=>this.actions.end());
          row.append(slider);
        }
        input=document.createElement('input');input.type='text';input.inputMode=c.kind==='integer'?'numeric':'decimal';input.className='numeric-entry';input.setAttribute('role','spinbutton');
        input.setAttribute('aria-valuemin',String(c.min*factor));input.setAttribute('aria-valuemax',String(c.max*factor));
        this.textEditing(input,c.key,text=>text.trim()===''?NaN:Number(text)/factor);
        input.addEventListener('keydown',event=>{
          if(event.key!=='ArrowUp'&&event.key!=='ArrowDown')return;
          event.preventDefault();
          const value=Number(input.value)/factor;
          if(Number.isFinite(value)){this.actions.begin();this.actions.change(c.key,Math.min(Number(input.getAttribute('aria-valuemax'))/factor,Math.max(Number(input.getAttribute('aria-valuemin'))/factor,value+(event.key==='ArrowUp'?1:-1)*c.step)));}
        });
        input.addEventListener('keyup',event=>{if(event.key==='ArrowUp'||event.key==='ArrowDown')this.actions.end();});
        const wrap=document.createElement('span');wrap.className='number-wrap';wrap.append(input);
        const unit=document.createElement('span');unit.className='unit';unit.textContent=c.unit==='cm'?'cm':c.unit==='m'?'m':c.unit==='ratio'&&(c.ratioBasis==='width'||c.ratioBasis==='height')?'of '+c.ratioBasis:c.inputUnit==='degrees'?'°':'';wrap.append(unit);row.append(wrap);
        if(c.unit==='seed'){
          const random=document.createElement('button');random.textContent='New seed';random.addEventListener('click',()=>this.actions.change(c.key,Math.floor(Math.random()*(c.max-c.min+1))+c.min));row.append(random);
        }
        output=document.createElement('output');output.id=c.key+'-value';output.className='sr-only';row.append(output);wrapper.append(row);
      } else if(c.kind==='choice') {
        input=document.createElement('select');
        for(const option of c.options){const o=document.createElement('option');o.value=option.value;o.textContent=option.label;input.append(o);}
        input.addEventListener('change',()=>this.actions.change(c.key,input.value));wrapper.append(input);
      } else if(c.kind==='toggle') {
        input=document.createElement('input');input.type='checkbox';
        input.addEventListener('change',()=>this.actions.change(c.key,(input as HTMLInputElement).checked));
        const row=document.createElement('div');row.className='toggle-row';row.append(input);
        const text=document.createElement('span');text.textContent='Include '+displayLabel.toLowerCase();row.append(text);wrapper.append(row);
      } else {
        const row=document.createElement('div');row.className='color-row';
        picker=document.createElement('input');picker.type='color';picker.setAttribute('aria-label',displayLabel+' color picker');
        picker.addEventListener('input',()=>{this.actions.begin();this.actions.change(c.key,picker!.value);});
        picker.addEventListener('change',()=>this.actions.end());picker.addEventListener('blur',()=>this.actions.end());
        input=document.createElement('input');input.type='text';input.className='hex-entry';input.spellcheck=false;input.maxLength=7;
        this.textEditing(input,c.key,text=>text.trim());row.append(picker,input);wrapper.append(row);
      }
      input.id=c.key;input.setAttribute('aria-describedby',hint.id+' '+error.id);wrapper.append(hint,details,error);this.host.append(wrapper);
      this.fields.set(c.key,{control:c,wrapper,input,slider,picker,output,reset,error,hint,details,status});
    }
    this.show(this.group);
  }
  private textEditing(input:HTMLInputElement,key:string,parse:(text:string)=>unknown) {
    let dirty=false;
    input.addEventListener('input',()=>{dirty=true;this.actions.pending(key,true);});
    const commit=()=>{if(!dirty)return;const value=parse(input.value);dirty=false;this.actions.pending(key,false);this.actions.change(key,value);};
    input.addEventListener('blur',commit);
    input.addEventListener('keydown',event=>{
      if(event.key==='Enter'){event.preventDefault();commit();input.blur();}
      if(event.key==='Escape'){event.preventDefault();dirty=false;this.actions.pending(key,false);input.blur();this.actions.change(key,undefined);}
    });
  }
  show(group:string) {
    this.group=group;
    for(const child of this.host.children) (child as HTMLElement).hidden=(child as HTMLElement).dataset.group!==group;
  }
  showControl(key?:string) {
    for(const child of this.host.children)(child as HTMLElement).hidden=key!==undefined&&(child as HTMLElement).dataset.key!==key;
  }
  select(role?:string) {
    for(const field of this.fields.values()){
      const selected=field.control.kind==='color' && field.control.role===role;
      field.wrapper.classList.toggle('selected',selected);
      if(selected){field.wrapper.scrollIntoView({block:'nearest'});field.input.focus({preventScroll:true});}
    }
  }
  refresh(d:Descriptor,config:Design,draft:Record<string,unknown>,issues:ParameterIssue[],pending:Set<string>) {
    const state=d.state(draft);
    for(const [key,field] of this.fields){
      const c=field.control,value=Object.hasOwn(draft,key)?draft[key]:config.applied[key];
      const focused=document.activeElement===field.input;
      if(!focused || !pending.has(key)) {
        if(c.kind==='toggle') (field.input as HTMLInputElement).checked=Boolean(value);
        else if(c.kind==='range'||c.kind==='integer') field.input.value=typeof value==='number' && Number.isFinite(value)?String(Number((value*(c.unit==='cm'?100:1)).toFixed(6))):'';
        else field.input.value=String(value??'');
      }
      if(field.slider && typeof value==='number' && Number.isFinite(value)) field.slider.value=String(value);
      if(field.output) field.output.textContent=field.input.value;
      if(field.picker && typeof value==='string' && /^#[0-9a-f]{6}$/i.test(value)) field.picker.value=value;
      const limits=state.controls[key],disabled=limits?.enabled===false;
      field.input.disabled=disabled;if(field.slider)field.slider.disabled=disabled;if(field.picker)field.picker.disabled=disabled;
      field.reset.disabled=disabled||(c.kind==='color'?!Object.hasOwn(draft,key):value===d.defaults[key]);
      field.wrapper.dataset.disabled=String(disabled);
      field.status.textContent=pending.has(key)?'Editing':value!==d.defaults[key]?'Changed':'';
      field.hint.textContent=[c.kind==='color'?'Applies to all '+readableRegion(c.label).toLowerCase()+' pieces.':c.hint,limits?.hint].filter(Boolean).join(' ');
      const targets=c.targets.map(readableRegion).join(', ');let range='';
      if(c.kind==='range'||c.kind==='integer'){const factor=c.unit==='cm'?100:1,min=limits?.min??c.min,max=limits?.max??c.max;field.input.setAttribute('aria-valuemin',String(min*factor));field.input.setAttribute('aria-valuemax',String(max*factor));range='Range '+Number((min*factor).toFixed(6))+'–'+Number((max*factor).toFixed(6))+(c.unit==='cm'?' cm':c.unit==='m'?' m':c.inputUnit==='degrees'?'°':'')+'. ';}
      field.details.textContent=range+(disabled?'Inactive for the current construction. ':'')+(targets?'Affects '+targets+'.':'');
      const messages=issues.filter(i=>i.keys.includes(key)).map(i=>i.message);
      field.error.textContent=messages.join(' ');
      field.wrapper.setAttribute('aria-invalid',String(messages.length>0));
      field.input.setAttribute('aria-invalid',String(messages.length>0));
      if((c.kind==='range'||c.kind==='integer') && field.slider){
        field.slider.min=String(limits?.min??c.min);field.slider.max=String(limits?.max??c.max);
      }
    }
    for(const button of this.palettes) button.setAttribute('aria-pressed',String(paletteMatches(d,config.applied,button.dataset.colorway!)));
  }
}
