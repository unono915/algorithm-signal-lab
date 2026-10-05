import {DEFAULTS,cleanConfig} from './levels.js';
export const STORAGE_KEY='signal-lab-progress-v1';
export function normalizeState(raw){
 const valid=raw&&raw.version===1;const state={version:1,progress:{},reduceMotion:valid&&raw.reduceMotion===true};
 for(let id=1;id<=8;id++){const p=valid&&raw.progress?.[id];const config=cleanConfig(id,p?.config);const keys=Object.keys(DEFAULTS[id]).filter(k=>k!=='order');const legacy=p?.config&&typeof p.config==='object'&&!Array.isArray(p.config)&&!p.draft;const used=new Set();const orderSlots=(DEFAULTS[id].order||[]).map((_,i)=>{const value=legacy?config.order[i]:p?.draft?.orderSlots?.[i];if(!config.order.includes(value)||used.has(value))return null;used.add(value);return value});const placed=legacy?keys:keys.filter(k=>Array.isArray(p?.draft?.placed)&&p.draft.placed.includes(k));state.progress[id]={config,draft:{placed,orderSlots},completed:p?.completed===true,hint:Number.isFinite(p?.hint)?Math.min(3,Math.max(0,Math.floor(p.hint))):0,proof:p?.proof===true};}
 return state;
}
export function createStore(storage){
 const warning='이 브라우저에서는 진행을 저장할 수 없어요. 현재 화면에서는 계속 풀 수 있어요.';
 return {
  load(){try{const text=storage.getItem(STORAGE_KEY);if(!text)return {state:normalizeState(null),warning:null};const parsed=JSON.parse(text);return {state:normalizeState(parsed),warning:parsed?.version===1?null:'저장 형식이 달라 기본 상태로 시작해요.'}}catch{return {state:normalizeState(null),warning:'저장된 진행을 불러오지 못했어요. 기본 상태에서 계속할 수 있어요.'}}},
  save(state){try{storage.setItem(STORAGE_KEY,JSON.stringify(normalizeState(state)));return {ok:true,warning:null}}catch{return {ok:false,warning}}},
  clear(){try{storage.removeItem(STORAGE_KEY);return {ok:true,warning:null}}catch{return {ok:false,warning}}}
 };
}
