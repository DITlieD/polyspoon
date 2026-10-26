export function fields(input:unknown,allowed:readonly string[]):Record<string,unknown> {
  if(!input||typeof input!=='object'||Array.isArray(input)||![Object.prototype,null].includes(Object.getPrototypeOf(input))||Reflect.ownKeys(input).some(key=>typeof key!=='string'||!allowed.includes(key)))throw new Error('Invalid environment fields');
  return input as Record<string,unknown>;
}
export function bounded(value:unknown,min:number,max:number,integer=false):number {
  if(typeof value!=='number'||!Number.isFinite(value)||value<min||value>max||integer&&!Number.isInteger(value))throw new Error('Environment number outside bounds');
  return value;
}
