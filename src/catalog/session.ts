import { plainRecord } from '../engine/parameters.ts';
import { designInput, parseAppearance } from './appearance.ts';
import { buildAsset, descriptor, disposeAsset, loadDesign } from './index.ts';
import type { AssetBuild, Design } from './index.ts';
import type { MigrationNotice } from '../engine/parameters.ts';

interface History { past: Design[]; future: Design[] }
export class DesignSession {
  build: AssetBuild = buildAsset();
  revision = 0;
  private readonly saved = new Map<string, Design>();
  private readonly histories = new Map<string, History>();
  private gesture?: Design;
  get config() { return this.build.config; }
  private get history(): History {
    const id=this.config.family;
    if(!this.histories.has(id)) this.histories.set(id,{past:[],future:[]});
    return this.histories.get(id)!;
  }
  get canUndo() { return this.history.past.length>0; }
  get canRedo() { return this.history.future.length>0; }
  private remember(before: Design) {
    if(JSON.stringify(designInput(before))===JSON.stringify(designInput(this.config))) return;
    const history=this.history;
    history.past.push(structuredClone(before));
    if(history.past.length>80) history.past.shift();
    history.future=[];
  }
  beginGesture() { if(!this.gesture) this.gesture=structuredClone(this.config); }
  endGesture() {
    if(!this.gesture) return;
    const before=this.gesture; this.gesture=undefined;
    if(before.family===this.config.family) this.remember(before);
  }
  private commit(family: string, input: unknown, record=true, migration?:MigrationNotice) {
    const next = buildAsset(family, input), old=this.build;
    if(migration)next.config.migration=structuredClone(migration);
    this.saved.set(old.config.family, structuredClone(old.config));
    this.build = next;
    this.saved.set(family, structuredClone(next.config));
    if(record && !this.gesture && family===old.config.family) this.remember(old.config);
    return old;
  }
  apply(input: unknown) { this.revision++; return this.commit(this.config.family, {...plainRecord(input),...(this.config.appearance?{appearance:this.config.appearance}:{})},true,this.config.migration); }
  setAppearance(input:unknown) { this.endGesture();this.revision++;return this.commit(this.config.family,{...this.config.requested,appearance:parseAppearance(input)},true,this.config.migration); }
  select(family: string) {
    this.endGesture(); this.revision++; descriptor(family);
    return this.commit(family, this.saved.has(family)?designInput(this.saved.get(family)!):{},false,this.saved.get(family)?.migration);
  }
  reset() { this.endGesture(); this.revision++; return this.commit(this.config.family,{}); }
  undo(): AssetBuild | false {
    this.endGesture(); this.revision++;
    const history=this.history, before=history.past.at(-1);
    if(!before) return false;
    const current=structuredClone(this.config), old=this.commit(before.family,designInput(before),false,before.migration);
    history.past.pop(); history.future.push(current); return old;
  }
  redo(): AssetBuild | false {
    this.endGesture(); this.revision++;
    const history=this.history, next=history.future.at(-1);
    if(!next) return false;
    const current=structuredClone(this.config), old=this.commit(next.family,designInput(next),false,next.migration);
    history.future.pop(); history.past.push(current); return old;
  }
  load(input: unknown) {
    this.endGesture(); this.revision++;
    const d = loadDesign(input);
    if(d.family!==this.config.family) {
      const previous=this.saved.get(d.family)??descriptor(d.family).save({});
      const old=this.commit(d.family,designInput(d),false,d.migration);
      if(previous) this.remember(previous);
      return old;
    }
    const old=this.commit(d.family,designInput(d),true,d.migration);
    return old;
  }
  beginLoad() { return ++this.revision; }
  finishLoad(ticket: number, input: unknown): AssetBuild | false {
    if (ticket !== this.revision) return false;
    return this.load(input);
  }
  dispose() { disposeAsset(this.build); }
}
