// Text scan (REAL detector): every string extracted from the file, the title/description, and OCR output are
// normalised (NFKC, confusables, upside-down letters, diacritics, leetspeak, separators, reversal, kana) and matched
// against the in-repo English + Japanese wordlist. It also looks for instruction-like text aimed at an AI reviewer;
// such text is treated purely as data and raises `suspicious_instructions` (a flag), never a pass.
import {readFileSync} from 'node:fs';
import type {TextHit} from './types.ts';
export const TEXT_DETECTOR='text-wordlist-v1',INSTRUCTION_DETECTOR='instruction-scan-v1';
type Entry={t:string;category:TextHit['category'];severity:TextHit['severity'];mode:'substring'|'token'|'phrase'};
const decode=(s:string)=>Buffer.from(s,'base64').toString('utf8');
let cached:{terms:(Entry&{re:RegExp;token:RegExp})[];allow:string[]}|null=null;
export function wordlist(path=new URL('./wordlist.json',import.meta.url)){
 if(cached)return cached;const raw=JSON.parse(readFileSync(path,'utf8')) as {terms:Entry[];allow:string[]};
 const pattern=(t:string)=>[...t].map(c=>c.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'+').join('');
 cached={terms:raw.terms.map(e=>{const t=fold(decode(e.t));return {...e,t,re:new RegExp(pattern(t),'gu'),token:new RegExp('^'+pattern(t)+'$','u')};}),allow:raw.allow.map(a=>fold(decode(a)))};
 return cached;
}
const CONFUSABLE:Record<string,string>={'а':'a','е':'e','о':'o','р':'p','с':'c','у':'y','х':'x','і':'i','ј':'j','ѕ':'s','к':'k','м':'m','т':'t','н':'h','в':'b','г':'r','ԁ':'d','ο':'o','α':'a','ν':'v','ι':'i','κ':'k','τ':'t','ρ':'p','ε':'e','υ':'u','χ':'x','ɡ':'g','ı':'i'};
const FLIPPED:Record<string,string>={'ɐ':'a','ǝ':'e','ɟ':'f','ƃ':'g','ɥ':'h','ᴉ':'i','ɾ':'j','ʞ':'k','ɯ':'m','ɹ':'r','ʇ':'t','ʌ':'v','ʍ':'w','ʎ':'y'};
const LEET:Record<string,string>={'0':'o','1':'i','3':'e','4':'a','5':'s','7':'t','8':'b','9':'g','@':'a','$':'s','!':'i','|':'i','+':'t','€':'e','£':'l'};
/** Canonical letters: NFKC, lower case, confusables and flipped letters mapped, diacritics removed, hiragana→katakana. */
export function fold(input:string){
 let s=input.normalize('NFKC').toLowerCase();
 s=[...s].map(c=>CONFUSABLE[c]??FLIPPED[c]??c).join('');
 s=s.normalize('NFD').replace(/\p{M}/gu,'').normalize('NFC');
 return s.replace(/[\u3041-\u3096]/g,c=>String.fromCharCode(c.charCodeAt(0)+0x60));
}
const letter=/[\p{L}]/u;
function variants(folded:string){const a=[...folded].map(c=>LEET[c]??c).join(''),b=[...folded].map(c=>c==='1'?'l':LEET[c]??c).join('');return [...new Set([a,b])];}
/** Letters only, with a map back to positions in the variant string. Separators and digits-as-noise vanish. */
function compact(s:string){let out='';const at:number[]=[];[...s].forEach((c,i)=>{if(letter.test(c)){out+=c;at.push(i);}});return {out,at};}
function scanOne(text:string,source:string):TextHit[]{
 const list=wordlist(),hits:TextHit[]=[];if(!text.trim())return hits;
 for(const v of variants(fold(text))){
  const chars=[...v];let cleaned=chars.join('');
  for(const a of list.allow)cleaned=cleaned.split(a).join(' '.repeat([...a].length));
  const cleanChars=[...cleaned],tokens=cleaned.split(/[^\p{L}]+/u).filter(Boolean);
  for(const e of list.terms){
   if(e.mode==='token'){const tok=tokens.find(t=>e.token.test(t));if(tok)hits.push({category:e.category,severity:e.severity,term:e.t,source,span:tok.slice(0,60),detector:TEXT_DETECTOR});continue;}
   for(const forward of [true,false]){
    const seq=forward?cleanChars:[...cleanChars].reverse(),{out,at}=compact(seq.join(''));e.re.lastIndex=0;const m=e.re.exec(out);if(!m)continue;
    const start=at[m.index]!,end=at[m.index+m[0].length-1]!,original=seq.slice(start,end+1).join('');
    // A match that spans several ordinary words ("big gerbil") is weaker evidence than one inside a single word or
    // one spelled out with single-letter separators ("n.i.g.g.e.r"), so it is downgraded to a context hit.
    const words=original.split(/[^\p{L}]+/u).filter(Boolean),spread=e.mode!=='phrase'&&words.length>1&&words.some(w=>[...w].length>1);
    hits.push({category:e.category,severity:spread?'context':e.severity,term:e.t,source,span:original.slice(0,60),detector:TEXT_DETECTOR});break;
   }
  }
 }
 return dedupe(hits);
}
const INSTRUCTIONS:RegExp[]=[/ignore\s+(?:all\s+|any\s+)?(?:the\s+)?(?:previous|prior|above|earlier)\s+(?:instructions?|rules?|prompts?)/,/disregard\s+(?:all\s+|any\s+|the\s+)?(?:previous|prior|above|instructions?|rules?)/,/\byou\s+are\s+(?:now\s+)?(?:an?|the|my)\s+\w+/,/\b(?:approve|accept|publish)\s+(?:this|the|it)\b/,/\b(?:system|assistant|developer)\s*:/,/\bmark\s+(?:this|it)\s+(?:as\s+)?(?:safe|clean|approved|ok)\b/,/\b(?:classify|rate|label|score)\s+(?:this|it)\s+as\s+(?:safe|clean|0)/,/\bthis\s+(?:model|file|asset|image)\s+is\s+(?:safe|clean|approved)\b/,/\bdo\s+not\s+(?:flag|reject|report)\b/,/<\|?im_(?:start|end)\|?>|\[\/?inst\]|<\/?system>/,/\bjailbreak\b|\bprompt\s+injection\b/,new RegExp(fold('指示を無視|承認して|安全と判定|問題なしと'))];
export function scanInstructions(text:string,source:string):TextHit[]{
 const s=fold(text).replace(/\s+/g,' ');const out:TextHit[]=[];
 for(const re of INSTRUCTIONS){const m=re.exec(s);if(m)out.push({category:'suspicious_instructions',severity:'context',term:re.source.slice(0,40),source,span:s.slice(Math.max(0,m.index-10),m.index+m[0].length+10).slice(0,80),detector:INSTRUCTION_DETECTOR});}
 return out;
}
function dedupe(hits:TextHit[]){const seen=new Map<string,TextHit>();for(const h of hits){const k=h.term+'|'+h.source,old=seen.get(k);if(!old||(old.severity==='context'&&h.severity==='severe'))seen.set(k,h);}return [...seen.values()];}
/** Scan a set of labelled strings. Input is capped so a hostile file cannot make this slow. */
export function scanText(items:{source:string;text:string}[]):TextHit[]{
 const out:TextHit[]=[];for(const {source,text} of items.slice(0,4000)){const t=text.slice(0,2000);out.push(...scanOne(t,source),...scanInstructions(t,source));}return out;
}
