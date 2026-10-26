import type {Member} from './types.ts';
export function canModerate(member:Member){return member.status==='active'&&member.verified&&!member.scopes&&member.capabilities.some(role=>role==='moderator'||role==='admin');}
export function canReview(member:Member){return member.status==='active'&&member.verified&&!member.scopes&&member.capabilities.some(role=>role==='verifier'||role==='publisher'||role.startsWith('reviewer:'));}
export function canAdminister(member:Member){return member.status==='active'&&member.verified&&!member.scopes&&member.capabilities.includes('admin');}
export function memberNavigation(member:Member):Array<[string,string]>{
 if(member.status==='suspended')return [['Account notice','/catalog?view=notice']];
 const links:Array<[string,string]>=[['Models','/catalog'],['Following','/catalog?view=following'],['Leaderboard','/catalog?view=leaderboard'],['Collections','/catalog?view=collections'],['Your submissions','/contribute'],['Profile','/catalog?view=profile'],['Account','/catalog?view=account']];
 if(canReview(member))links.push(['Review queue','/catalog?view=review']);
 if(canModerate(member))links.push(['Moderation','/catalog?view=moderation']);if(canAdminister(member))links.push(['Members','/catalog?view=admin']);return links;
}
