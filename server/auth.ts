import {trustedClientAddress} from './client-address.ts';
import {betterAuth} from 'better-auth';
import {magicLink} from 'better-auth/plugins';
import {APIError} from 'better-auth/api';
import type {Env} from './types.ts';
import {sendLoginMail} from './mail.ts';
import {HttpError} from './domain.ts';

export function authenticationHeaders(request:Request,env:Env){
 const headers=new Headers(request.headers);for(const name of ['x-forwarded-for','x-real-ip','cf-connecting-ip','x-polyspoon-client-ip'])headers.delete(name);headers.set('x-polyspoon-client-ip',trustedClientAddress(request,env)??'127.0.0.1');return headers;
}

const authenticationFields=['APP_ENV','APP_ORIGIN','AUTH_SECRET','LOCAL_MAIL_SINK','RESEND_API_KEY','MAIL_FROM','SUPABASE_URL','SUPABASE_SERVICE_KEY','SUPABASE_PRIVATE_BUCKET'] as const;
type AuthenticationConfiguration=Readonly<Pick<Env,'DB'|typeof authenticationFields[number]>>;
const authenticationCache=new WeakMap<Env['DB'],{configuration:AuthenticationConfiguration;instance:ReturnType<typeof createAuthentication>}>();

export function authentication(env:Env){
 if(!env.AUTH_SECRET||env.AUTH_SECRET.length<32)throw new HttpError(503,'authentication_unconfigured');
 const cached=authenticationCache.get(env.DB);if(cached&&authenticationFields.every(field=>cached.configuration[field]===env[field]))return cached.instance;
 const configuration=Object.freeze({DB:env.DB,APP_ENV:env.APP_ENV,APP_ORIGIN:env.APP_ORIGIN,AUTH_SECRET:env.AUTH_SECRET,LOCAL_MAIL_SINK:env.LOCAL_MAIL_SINK,RESEND_API_KEY:env.RESEND_API_KEY,MAIL_FROM:env.MAIL_FROM,SUPABASE_URL:env.SUPABASE_URL,SUPABASE_SERVICE_KEY:env.SUPABASE_SERVICE_KEY,SUPABASE_PRIVATE_BUCKET:env.SUPABASE_PRIVATE_BUCKET});
 const instance=createAuthentication(configuration);authenticationCache.set(env.DB,{configuration,instance});void instance.$context.catch(()=>{if(authenticationCache.get(configuration.DB)?.instance===instance)authenticationCache.delete(configuration.DB);});return instance;
}
function createAuthentication(env:AuthenticationConfiguration){
 return betterAuth({
  database:env.DB,
  baseURL:env.APP_ORIGIN,
  basePath:'/api/auth',
  secret:env.AUTH_SECRET,
  trustedOrigins:[env.APP_ORIGIN],
  session:{cookieCache:{enabled:false},expiresIn:86400,disableSessionRefresh:true},
  rateLimit:{enabled:true,storage:'database',window:60,max:60},
  advanced:{ipAddress:{ipAddressHeaders:['x-polyspoon-client-ip']},cookiePrefix:'polyspoon',useSecureCookies:new URL(env.APP_ORIGIN).protocol==='https:'},
  plugins:[magicLink({expiresIn:300,storeToken:'hashed',rateLimit:{window:60,max:5},sendMagicLink:async({email,url})=>{try{await sendLoginMail(env,email,url);}catch(error){if(error instanceof HttpError)throw new APIError(error.status===429?'TOO_MANY_REQUESTS':'SERVICE_UNAVAILABLE',{message:error.code});throw error;}}})],

 });
}
