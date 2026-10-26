export interface Report {id:string;versionId:string;category:string;reason:string;status:'open'|'dismiss'|'withdraw';createdAt:number;decisionReason:string|null;title?:string}
export interface Appeal {id:string;message:string;status:'open'|'uphold'|'reinstate'|'superseded';createdAt:number;decisionReason:string|null;memberId?:string;restrictionReason:string|null;restrictedAt:number|null;actionable:boolean}
export interface Restriction {status:string;reason:string|null;restrictedAt:number|null;appeal:Appeal|null}
export interface AddressBlock {id:string;addressHash:string;reason:string;expiresAt:number;createdAt:number}
