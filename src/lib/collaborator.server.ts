import { adminClient, getServiceRoleKey, requireAdmin, requireUser } from "./supabase.server";

const PAID_STATUSES = new Set(["PAID", "SUCCESS", "COMPLETED", "CAPTURED", "FREE"]);
const makeCode = () => `${crypto.randomUUID().replaceAll("-", "")}${crypto.randomUUID().replaceAll("-", "").slice(0, 16)}`;
type Product = { id: string; title: string; category: string; price: number; active: boolean };
export type CollaboratorStats = { visitors: number; page_views: number; sales: number; revenue: number };
export type CollaboratorLink = CollaboratorStats & { id:string; code:string; name:string; user_id:string; email:string; active:boolean; created_at:string; url:string };
export type CollaboratorPartner = { user_id:string; email:string; full_name:string|null; active:boolean; links:CollaboratorLink[]; product_ids:string[]; products:Product[]; totals:CollaboratorStats };

async function getAuthorizedProductIds(userId:string){ const {data}=await adminClient().from("collaborator_partner_products").select("product_id").eq("user_id",userId); return ((data??[]) as {product_id:string}[]).map(r=>r.product_id); }
async function getProducts(ids?:string[]):Promise<Product[]> { let q=adminClient().from("products").select("id,title,category,price,active"); if(ids) q=q.in("id",ids.length?ids:["00000000-0000-0000-0000-000000000000"]); const {data,error}=await q; if(error) throw error; return (data??[]) as Product[]; }
async function statsForLink(id:string, collaboratorCode:string, allowedProductIds?:string[]):Promise<CollaboratorStats>{ const db=adminClient(); const [{data:views,error:viewError},{data:orders,error:orderError}]=await Promise.all([db.from("page_views").select("session_id").eq("collaborator_code",collaboratorCode).limit(100000),db.from("orders").select("id,product_id,amount,status").eq("collaborator_link_id",id).limit(100000)]); if(viewError) throw viewError; if(orderError) throw orderError; const allowed=allowedProductIds?new Set(allowedProductIds):null; const visible=((orders??[]) as {id:string;product_id:string|null;amount:number|string|null;status:string}[]).filter(o=>PAID_STATUSES.has((o.status??"").toUpperCase())&&(!allowed||(o.product_id?allowed.has(o.product_id):false))); const visitors=new Set(((views??[]) as {session_id:string|null}[]).map(v=>v.session_id).filter(Boolean)); return {visitors:visitors.size,page_views:(views??[]).length,sales:visible.length,revenue:visible.reduce((s,o)=>s+(Number(o.amount)||0),0)}; }
async function buildLink(row:{id:string;code:string;name:string;user_id:string;email:string;active:boolean;created_at:string},ids?:string[]){ return {...row,url:`/?ref=${row.code}`,...await statsForLink(row.id,row.code,ids)}; }
export async function listCollaboratorProducts(accessToken?:string){ await requireAdmin(accessToken); return getProducts(); }
export async function listCollaboratorLinks(accessToken?:string):Promise<CollaboratorLink[]>{ await requireAdmin(accessToken); const {data,error}=await adminClient().from("collaborator_links").select("id,code,name,user_id,email,active,created_at").order("created_at",{ascending:false}); if(error) throw error; return Promise.all(((data??[]) as Omit<CollaboratorLink,keyof CollaboratorStats|"url">[]).map(async r=>buildLink(r,await getAuthorizedProductIds(r.user_id)))); }
export async function listCollaboratorPartners(accessToken?:string):Promise<CollaboratorPartner[]>{ await requireAdmin(accessToken); const db=adminClient(); const {data,error}=await db.from("collaborator_links").select("id,code,name,user_id,email,active,created_at").order("created_at",{ascending:false}); if(error) throw error; const rows=(data??[]) as {id:string;code:string;name:string;user_id:string;email:string;active:boolean;created_at:string}[]; const byUser=new Map<string,typeof rows>(); for(const r of rows) byUser.set(r.user_id,[...(byUser.get(r.user_id)??[]),r]); const ids=[...byUser.keys()]; const {data:profiles}=ids.length?await db.from("profiles").select("id,email,full_name").in("id",ids):{data:[]}; const pm=new Map((profiles??[]).map(p=>[p.id as string,p])); const out:CollaboratorPartner[]=[]; for(const userId of ids){const productIds=await getAuthorizedProductIds(userId);const links=await Promise.all((byUser.get(userId)??[]).map(r=>buildLink(r,productIds)));const totals=links.reduce((s,l)=>({visitors:s.visitors+l.visitors,page_views:s.page_views+l.page_views,sales:s.sales+l.sales,revenue:s.revenue+l.revenue}),{visitors:0,page_views:0,sales:0,revenue:0});const p=pm.get(userId);out.push({user_id:userId,email:p?.email??links[0]?.email??"(unknown account)",full_name:(p?.full_name as string|null)??null,active:links.some(l=>l.active),links,product_ids:productIds,products:await getProducts(productIds),totals});} return out; }
export async function setCollaboratorProductAccess(accessToken:string|undefined,userId:string,productIds:string[]){ await requireAdmin(accessToken); const db=adminClient(); const clean=[...new Set(productIds)]; const {error:del}=await db.from("collaborator_partner_products").delete().eq("user_id",userId); if(del) throw del; if(clean.length){const {data:validProducts,error:productError}=await db.from("products").select("id").in("id",clean); if(productError)throw productError; const validIds=new Set((validProducts??[]).map(p=>p.id as string)); const invalid=clean.filter(id=>!validIds.has(id)); if(invalid.length)throw new Error("One or more selected products no longer exist"); const {error}=await db.from("collaborator_partner_products").insert(clean.map(product_id=>({user_id:userId,product_id})));if(error)throw error;} return {ok:true,productIds:clean}; }

export async function createCollaboratorLink(accessToken:string|undefined,name:string,email?:string,userId?:string,productIds:string[]=[]){
  await requireAdmin(accessToken);
  const admin=adminClient();
  let resolvedUserId=(userId??"").trim()||undefined;
  let resolvedEmail=(email??"").trim().toLowerCase();

  if(resolvedUserId){
    const {data:profile,error:profileError}=await admin.from("profiles").select("id,email").eq("id",resolvedUserId).maybeSingle();
    if(profileError) throw profileError;
    if(profile){
      resolvedEmail=(profile.email as string)||resolvedEmail;
    } else if(getServiceRoleKey()){
      try{
        const {data}=await admin.auth.admin.getUserById(resolvedUserId);
        if(data.user){resolvedEmail=(data.user.email??resolvedEmail).toLowerCase();}
      }catch{}
    }
    if(!resolvedEmail) throw new Error("The selected account has no email address");
  }else{
    if(!resolvedEmail) throw new Error("A registered user or email is required");
    const {data:profile,error:profileError}=await admin.from("profiles").select("id,email").ilike("email",resolvedEmail).maybeSingle();
    if(profileError) throw profileError;
    if(profile){
      resolvedUserId=profile.id as string;
      resolvedEmail=(profile.email as string)||resolvedEmail;
    }else if(getServiceRoleKey()){
      const {data,error}=await admin.auth.admin.listUsers({page:1,perPage:1000});
      if(error) throw error;
      const match=data.users.find(user=>(user.email??"").toLowerCase()===resolvedEmail);
      if(match){resolvedUserId=match.id;resolvedEmail=(match.email??resolvedEmail).toLowerCase();}
    }
  }

  if(!resolvedUserId) throw new Error("No registered user was found for that email");

  const cleanProductIds=[...new Set(productIds)];
  if(cleanProductIds.length){
    const {data:validProducts,error:productError}=await admin.from("products").select("id").in("id",cleanProductIds);
    if(productError) throw productError;
    const validIds=new Set((validProducts??[]).map(p=>p.id as string));
    const invalid=cleanProductIds.filter(id=>!validIds.has(id));
    if(invalid.length) throw new Error("One or more selected products no longer exist");
  }

  for(let attempt=0;attempt<3;attempt++){
    const {data,error}=await admin.from("collaborator_links").insert({name:name.trim(),email:resolvedEmail,user_id:resolvedUserId,code:makeCode(),active:true}).select("id,code,name,user_id,email,active,created_at").single();
    if(!error){
      if(cleanProductIds.length){
        const {error:accessError}=await admin.from("collaborator_partner_products").insert(cleanProductIds.map(product_id=>({user_id:resolvedUserId,product_id})));
        if(accessError){ await admin.from("collaborator_links").delete().eq("id",data.id); throw accessError; }
      }
      return {...data,url:`/?ref=${data.code}`};
    }
    if(error.code!=="23505")throw error;
  }
  throw new Error("Could not generate a unique collaborator link. Please try again.");
}
export async function toggleCollaboratorLink(accessToken:string|undefined,id:string,active:boolean){await requireAdmin(accessToken);const {data,error}=await adminClient().from("collaborator_links").update({active}).eq("id",id).select("id,active").single();if(error)throw error;return data;}
export async function revokeCollaboratorPartner(accessToken:string|undefined,userId:string){ await requireAdmin(accessToken); const db=adminClient(); const {error:linkError}=await db.from("collaborator_links").update({active:false}).eq("user_id",userId); if(linkError)throw linkError; const {error:productError}=await db.from("collaborator_partner_products").delete().eq("user_id",userId); if(productError)throw productError; return {ok:true}; }
export async function getCollaboratorLinkStats(accessToken:string|undefined,id:string){await requireAdmin(accessToken);const {data:link,error}=await adminClient().from("collaborator_links").select("id,code,user_id").eq("id",id).maybeSingle();if(error)throw error;if(!link)throw new Error("Collaborator link not found");return statsForLink(link.id,link.code,await getAuthorizedProductIds(link.user_id));}
export async function getCollaboratorDashboard(accessToken?:string){const user=await requireUser(accessToken); const {data:linkRows,error}=await adminClient().from("collaborator_links").select("id,code,name,email,active,created_at,user_id").eq("user_id",user.id).order("created_at",{ascending:false});if(error)throw error;const links=(linkRows??[]) as {id:string;code:string;name:string;email:string;active:boolean;created_at:string;user_id:string}[];const activeLinks=links.filter(l=>l.active);if(!activeLinks.length)throw new Error("Collaborator access has been revoked or has not been assigned");const productIds=await getAuthorizedProductIds(user.id);const products=await getProducts(productIds);const scoped=await Promise.all(activeLinks.map(l=>buildLink(l,productIds)));const totals=scoped.reduce((s,l)=>({visitors:s.visitors+l.visitors,page_views:s.page_views+l.page_views,sales:s.sales+l.sales,revenue:s.revenue+l.revenue}),{visitors:0,page_views:0,sales:0,revenue:0});return {userId:user.id,email:user.email??scoped[0]?.email??null,links:scoped,products,productIds,totals};}