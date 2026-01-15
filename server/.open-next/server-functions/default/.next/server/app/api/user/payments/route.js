"use strict";(()=>{var e={};e.id=367,e.ids=[367],e.modules={846:e=>{e.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},4870:e=>{e.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},3295:e=>{e.exports=require("next/dist/server/app-render/after-task-async-storage.external.js")},9294:e=>{e.exports=require("next/dist/server/app-render/work-async-storage.external.js")},3033:e=>{e.exports=require("next/dist/server/app-render/work-unit-async-storage.external.js")},5345:(e,t,r)=>{r.r(t),r.d(t,{patchFetch:()=>_,routeModule:()=>m,serverHooks:()=>x,workAsyncStorage:()=>l,workUnitAsyncStorage:()=>y});var a={};r.r(a),r.d(a,{GET:()=>c,runtime:()=>d});var s=r(201),n=r(870),p=r(5165),i=r(8728),o=r(1554),u=r(3544);let d="nodejs";async function c(e){try{let t=await (0,o.HW)();if(!t)return i.NextResponse.json({error:"Not authenticated"},{status:401});let r=e.nextUrl.searchParams,a=parseInt(r.get("page")||"1"),s=Math.min(parseInt(r.get("limit")||"10"),50),n=(a-1)*s,p=(0,u.x)(),d=await p.prepare(`
      SELECT COUNT(*) as count FROM payments WHERE user_id = ?
    `).bind(t.id).first(),c=d?.count||0,{results:m}=await p.prepare(`
      SELECT 
        pay.*,
        s.plan_type as subscription_plan_type,
        s.status as subscription_status,
        p.name as product_name
      FROM payments pay
      LEFT JOIN subscriptions s ON pay.subscription_id = s.id
      LEFT JOIN products p ON s.product_id = p.id
      WHERE pay.user_id = ?
      ORDER BY pay.created_at DESC
      LIMIT ? OFFSET ?
    `).bind(t.id,s,n).all(),l=m.map(e=>({id:e.id,paymentId:e.payment_id,amount:e.amount,currency:e.currency,status:e.status,paymentMethod:e.payment_method,metadata:e.metadata?JSON.parse(e.metadata):null,createdAt:e.created_at,subscription:e.subscription_id?{planType:e.subscription_plan_type,status:e.subscription_status,product:{name:e.product_name}}:null}));return i.NextResponse.json({payments:l,pagination:{page:a,limit:s,total:c,totalPages:Math.ceil(c/s)}})}catch(e){return console.error("Get payments error:",e),i.NextResponse.json({error:"Internal server error"},{status:500})}}let m=new s.AppRouteRouteModule({definition:{kind:n.RouteKind.APP_ROUTE,page:"/api/user/payments/route",pathname:"/api/user/payments",filename:"route",bundlePath:"app/api/user/payments/route"},resolvedPagePath:"/Users/dexter/project/rebebuca/server/app/api/user/payments/route.ts",nextConfigOutput:"standalone",userland:a}),{workAsyncStorage:l,workUnitAsyncStorage:y,serverHooks:x}=m;function _(){return(0,p.patchFetch)({workAsyncStorage:l,workUnitAsyncStorage:y})}}};var t=require("../../../../webpack-runtime.js");t.C(e);var r=e=>t(t.s=e),a=t.X(0,[617,960,269,429,56],()=>r(5345));module.exports=a})();