export async function verifiedArtifactBytes(bytes:Uint8Array,expected:{bytes:number;sha256:string},label:string):Promise<Uint8Array<ArrayBuffer>> {
  const copy=Uint8Array.from(bytes),size=expected.bytes,sha256=expected.sha256;
  if(copy.length!==size)throw new Error(label+' size mismatch');
  const digest=await crypto.subtle.digest('SHA-256',copy);
  const hex=Array.from(new Uint8Array(digest),value=>value.toString(16).padStart(2,'0')).join('');
  if(hex!==sha256)throw new Error(label+' digest mismatch');
  return copy;
}
