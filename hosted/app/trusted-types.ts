export interface TrustedRecipe {
 id:string;
 version:string;
 deliveryRevision:number;
 sourceHash:string;
 archive:{path:string;sha256:string;bytes:number};
 licenses:{software:string;content:string;contentPaths:string[];thirdParty:string};
 notices:Record<string,string>;
}
