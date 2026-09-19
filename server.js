import express from "express";
import OpenAI from "openai";
import { InferenceClient } from "@huggingface/inference";
import path from "node:path";
import { fileURLToPath } from "node:url";
const __dirname=path.dirname(fileURLToPath(import.meta.url)),app=express();
app.use(express.json({limit:"2mb"}));
const phone=req=>/Android|iPhone|iPad|iPod|Mobile|Windows Phone/i.test(req.headers["user-agent"]||"");
app.get("/api/health",(_,res)=>res.json({ok:true,openai:!!process.env.OPENAI_API_KEY,openSource:!!process.env.HF_TOKEN,pinterest:!!process.env.PINTEREST_ACCESS_TOKEN}));
async function openai(prompt,format){
 const c=new OpenAI({apiKey:process.env.OPENAI_API_KEY});
 const size={"1:1":"1024x1024","4:5":"1024x1536","9:16":"1024x1536"}[format]||"1024x1536";
 const r=await c.images.generate({model:"gpt-image-2",prompt,size});
 const b=r?.data?.[0]?.b64_json;if(!b)throw Error("OpenAI returned no image.");
 return `data:image/png;base64,${b}`;
}
async function hf(prompt){
 const c=new InferenceClient(process.env.HF_TOKEN);
 const img=await c.textToImage({model:process.env.OPEN_SOURCE_MODEL||"black-forest-labs/FLUX.1-schnell",inputs:prompt,provider:"auto"});
 return `data:image/png;base64,${Buffer.from(await img.arrayBuffer()).toString("base64")}`;
}
async function trends(q){
 if(!process.env.PINTEREST_ACCESS_TOKEN)return "";
 try{
  const region=process.env.PINTEREST_REGION||"NG";
  const u=`https://api.pinterest.com/v5/trends/keywords/${encodeURIComponent(region)}/top/growing?limit=20`;
  const r=await fetch(u,{headers:{Authorization:`Bearer ${process.env.PINTEREST_ACCESS_TOKEN}`}});
  if(!r.ok)return "";
  const d=await r.json(), words=(d.trends||[]).map(x=>x.keyword).filter(Boolean);
  const rel=words.filter(x=>q.toLowerCase().split(/\s+/).some(w=>w.length>3&&x.toLowerCase().includes(w))).slice(0,5);
  return rel.length?`Private Pinterest trend signal only: ${rel.join(", ")}.`:"";
 }catch{return ""}
}
app.post("/api/generate",async(req,res)=>{
 try{
  if(!phone(req))return res.status(403).json({error:"Wisdom AI is phone-only. Open it from a phone."});
  const {prompt,format="4:5",provider="openai"}=req.body||{};
  if(!prompt?.trim())return res.status(400).json({error:"Please describe the design."});
  const t=await trends(prompt);
  const p=`Create an ORIGINAL professional social-media/business graphic. Never copy a specific Pinterest pin, artwork, logo, or person's design. Pinterest is only a private trend signal and must never be shown or mentioned inside the design. Make it look like a current professional human-designed flyer with realistic photography when appropriate, strong hierarchy, sophisticated typography, intentional spacing, premium composition, and no generic AI template look. Format ${format}. User brief: ${prompt}. ${t}`;
  let image;
  if(provider==="openai"){if(!process.env.OPENAI_API_KEY)throw Error("OpenAI is not configured.");image=await openai(p,format)}
  else {if(!process.env.HF_TOKEN)throw Error("Open-source AI is not configured. Add HF_TOKEN on the server.");image=await hf(p)}
  res.json({image,provider});
 }catch(e){console.error(e);res.status(500).json({error:e.message||"Generation failed."})}
});
app.get("/{*splat}",(_,res)=>res.sendFile(path.join(__dirname,"index.html")));
app.listen(process.env.PORT||3000,()=>console.log("Wisdom AI running"));
