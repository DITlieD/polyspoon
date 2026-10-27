// Shared types for the safety-v1 pre-review. The pipeline is a PRE-FILTER: its strongest outcome is `reject`
// (an appealable auto-rejection) and its weakest is `pass` (eligible for human review). Nothing here can approve,
// publish, or grant a capability; the Worker's triggers and the human review/publisher steps stay the only way in.
export type Category='sexual'|'child_like'|'hate_symbol'|'slur_text'|'violence'|'suspicious_instructions'|'hidden_geometry'|'invalid_file'|'analysis_incomplete';
export type Band='low'|'flag'|'reject';
export type Outcome='pass'|'flag'|'reject'|'incomplete';
export const BAND_RANK:Record<Band,number>={low:0,flag:1,reject:2};
export const OUTCOME_RANK:Record<Outcome,number>={pass:0,flag:1,incomplete:1,reject:2};

/** One rendered or extracted image as produced inside the jail. `name` is a fixed, server-validated pattern. */
export interface SafetyImage{name:string;kind:ImageKind;mime:'image/png'|'image/jpeg';data:Uint8Array;width:number;height:number}
export type ImageKind='view-lit'|'view-unlit'|'pass-normal'|'pass-wireframe'|'slice'|'backface'|'grid-crop'|'island'|'texture-tile';

/** Scores an image detector produced for one image, 0..1 per category, with an optional box in image pixels. */
export interface ImageScore{image:string;category:'sexual'|'child_like'|'hate_symbol'|'violence';score:number;bbox?:[number,number,number,number];detector:string}
export interface TextHit{category:'slur_text'|'sexual'|'hate_symbol'|'suspicious_instructions';severity:'severe'|'context';term:string;source:string;span:string;detector:string}

/** Detector registry entry. `real:false` marks a deterministic stand-in that never produces evidence of its own. */
export interface DetectorInfo{id:string;version:string;real:boolean;categories:Category[];note:string}

export interface Finding{category:Category;detector:string;band:Band;score?:number;artifact?:string;bbox?:[number,number,number,number];textSpan?:string}

export interface Thresholds{
 version:string;enforce:boolean;maxImages:number;
 flag:{sexual:number;hate_symbol:number;violence:number;child_like:number;child_like_sexual:number};
 reject:{sexual_single:number;sexual_multi:number;sexual_multi_count:number;hate_symbol:number;child_like:number;child_like_sexual:number};
 text:{severe:Band;context:Band};hiddenGeometry:Band;tinyIslands:Band;suspiciousInstructions:Band;llm:'stricter_only';
}
