// import { createHash } from "crypto"; // Node.js only, not Edge compatible
export function sanitizeHttpUrl(raw:string){ const u=new URL(raw); if(!["http:","https:"].includes(u.protocol)) throw new Error("Bad scheme"); return u.toString(); }
export function parseDevice(ua:string){ const s=ua.toLowerCase(); if(/(bot|crawler|spider)/.test(s)) return "bot"; if(/mobile|iphone|android(?!.*tablet)/.test(s)) return "mobile"; if(/ipad|tablet/.test(s)) return "tablet"; return "desktop"; }
export function hostOnly(ref:string|null){ if(!ref) return ""; try{ return new URL(ref).host; }catch{ return ""; } }
const devSalt = process.env.NODE_ENV==="development" ? (process.env.INTERNAL_SECRET ?? "devsalt") : "";
export async function getDailySalt(){ return devSalt; } // can be replaced with KV + cron later
export async function hashIp(ip?:string) {
	const salt = await getDailySalt();
	const data = new TextEncoder().encode((ip ?? "0.0.0.0") + "|" + salt);
	// Use Web Crypto API for Edge compatibility
	const hashBuffer = await crypto.subtle.digest("SHA-256", data);
	// Convert buffer to hex string
	return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, "0")).join("");
}
