export interface ReleaseRecord {sha256:string;bytes:number;executable:boolean}
export interface ReleaseManifest {formatVersion:number;files:Record<string,ReleaseRecord>;contentHash:string;scan:{rules:string[];findings:number;archiveContentsIncluded:boolean}}
export function validateReleasePaths(paths:string[]):string[];
export function scanReleaseFile(path:string,bytes:Uint8Array,depth?:number):Array<{path:string;rule:string}>;
export function prepareRelease(input:{root:string;out:string;paths:string[]}):Promise<ReleaseManifest>;
export function verifyRelease(root:string):Promise<{valid:boolean;files:number;contentHash:string;scanFindings:number}>;
