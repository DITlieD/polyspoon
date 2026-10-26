// Cosmetic unlocks. Display only: nothing here is read by review, publication, moderation, capability or scoring code.
export type Cosmetic={id:string;label:string;minLevel:number};
export const ACCENTS:readonly Cosmetic[]=[
 {id:'default',label:'Polyspoon blue',minLevel:1},{id:'slate',label:'Slate',minLevel:1},
 {id:'moss',label:'Moss',minLevel:2},{id:'clay',label:'Clay',minLevel:2},
 {id:'plum',label:'Plum',minLevel:3},{id:'ocean',label:'Ocean',minLevel:3},
 {id:'amber',label:'Amber',minLevel:4},{id:'rose',label:'Rose',minLevel:4},
 {id:'aurora',label:'Aurora gradient',minLevel:5},
 {id:'prism',label:'Prism gradient',minLevel:6},
];
export const FLAIRS:readonly Cosmetic[]=[
 {id:'none',label:'No frame',minLevel:1},
 {id:'ring',label:'Maker ring',minLevel:2},
 {id:'double',label:'Craftsperson double ring',minLevel:3},
 {id:'laurel',label:'Artisan laurel',minLevel:4},
 {id:'glow',label:'Master glow (animated level pill)',minLevel:5},
 {id:'crown',label:'Legend crown (animated level pill)',minLevel:6},
];
export function unlocked(list:readonly Cosmetic[],level:number){return list.map(item=>({...item,unlocked:level>=item.minLevel}));}
/** Throws a code string when the choice is unknown or locked at this level. */
export function checkCosmetic(list:readonly Cosmetic[],id:unknown,level:number,kind:'accent'|'flair'):string{
 const item=list.find(entry=>entry.id===id);if(!item)return 'invalid_'+kind;if(level<item.minLevel)return kind+'_locked';return '';
}
/** Downgrade a stored choice that is no longer unlocked (e.g. after a penalty) when displaying it. */
export function effective(list:readonly Cosmetic[],id:string,level:number,fallback:string){const item=list.find(entry=>entry.id===id);return item&&level>=item.minLevel?id:fallback;}
