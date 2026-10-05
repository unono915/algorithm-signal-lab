/** Deterministic, bounded interpreter. No evaluated strings or mutable trace references. */
const copy=value=>JSON.parse(JSON.stringify(value));
export function parseToken(value){
 if(typeof value==='object'&&value!==null){if(value.kind==='end')return {kind:'end',bits:null};if(['normal','damaged'].includes(value.kind)&&/^[01]{3}$/.test(value.bits))return {kind:value.kind,bits:value.bits};}
 if(value==='END')return {kind:'end',bits:null};
 if(typeof value==='string'&&/^!?[01]{3}$/.test(value))return {kind:value[0]==='!'?'damaged':'normal',bits:value.replace('!','')};
 throw Object.assign(new Error('입력 신호의 형식이 올바르지 않아요.'),{code:'INVALID_INPUT'});
}
export function execute(program,input,{maxSteps=200}={}){
 const state={position:0,current:null,outputs:[],energy:null,calls:0,stopped:false,stack:[]};
 const trace=[];let tokens=[],steps=0,error=null;
 const fail=(code,message)=>{throw Object.assign(new Error(message),{code})};
 const tick=(label,op,fn=()=>{},path='')=>{if(steps>=maxSteps)fail('STEP_LIMIT','실행이 너무 길어졌어요. 반복 안에서 다음 신호를 읽는지 확인하세요.');fn();steps++;trace.push({...copy(state),label,op,path,step:steps});};
 const needSignal=()=>{if(!state.current)fail('NO_SIGNAL','먼저 신호를 읽어 주세요.');if(state.current.kind==='end')fail('INVALID_SIGNAL','종료 표지에는 빛 연산을 할 수 없어요. 먼저 종료 여부를 확인하세요.');};
 const testCondition=condition=>{if(!state.current)fail('NO_SIGNAL','조건을 검사하기 전에 신호를 읽어 주세요.');switch(condition){case 'intact':return state.current.kind==='normal';case 'lit':return state.current.kind==='normal'&&state.current.bits.includes('1');case 'all':return true;case 'dark':return state.current.kind!=='end'&&state.current.bits==='000';default:fail('INVALID_PROGRAM','지원하지 않는 조건이에요. 기본 카드로 되돌려 주세요.')}};
 function run(body,path='main',insideFunction=false,depth=0){
  if(!Array.isArray(body)||depth>8)fail('INVALID_PROGRAM','명령 구조를 확인해 주세요.');
  for(let i=0;i<body.length&&!state.stopped;i++){
   const node=body[i],at=`${path}.${i}`;
   if(!node||typeof node.op!=='string')fail('INVALID_PROGRAM','빈 명령 슬롯이 있어요.');
   if(insideFunction&&!['rotate','flip','if','lightLast'].includes(node.op))fail('INVALID_FUNCTION','복원 함수에는 신호를 바꾸는 동작만 넣을 수 있어요.');
   switch(node.op){
    case 'read':if(state.position>=tokens.length)fail('EMPTY_INPUT','더 읽을 신호가 없어요. 반복 조건을 확인하세요.');tick('다음 신호 읽기','read',()=>{state.current=copy(tokens[state.position++])},at);break;
    case 'rotate':needSignal();tick('왼쪽으로 한 칸 회전','rotate',()=>{state.current.bits=state.current.bits.slice(1)+state.current.bits[0]},at);break;
    case 'flip':needSignal();tick('첫 칸 반전','flip',()=>{state.current.bits=(state.current.bits[0]==='1'?'0':'1')+state.current.bits.slice(1)},at);break;
    case 'lightLast':needSignal();tick('마지막 칸 켜기','lightLast',()=>{state.current.bits=state.current.bits.slice(0,2)+'1'},at);break;
    case 'emit':needSignal();tick('복원한 신호 보내기','emit',()=>{state.outputs.push(state.current.bits)},at);break;
    case 'init':tick('충전량을 0으로','init',()=>{state.energy=0},at);break;
    case 'charge':needSignal();if(state.energy===null)fail('UNINITIALIZED','충전량을 먼저 0으로 초기화해 주세요.');tick('켜진 칸 수만큼 충전','charge',()=>{state.energy+=[...state.current.bits].filter(b=>b==='1').length},at);break;
    case 'if':{const yes=testCondition(node.condition);const names={intact:'손상 표지가 없나요?',lit:'정상이고 켜진 칸이 있나요?',all:'모든 신호를 통과시키나요?',dark:'세 칸이 모두 꺼졌나요?'};tick(`${names[node.condition]} ${yes?'예':'아니요'}`,'if',()=>{},at);if(yes)run(node.body,at,insideFunction,depth+1);break;}
    case 'repeat':{if(!['input','count'].includes(node.mode)||node.mode==='count'&&(!Number.isInteger(node.count)||node.count<0||node.count>16))fail('INVALID_PROGRAM','반복 조건을 확인해 주세요.');let count=0;while(!state.stopped){const more=node.mode==='input'?state.position<tokens.length:count<node.count;tick(`${node.mode==='input'?'입력이 남아 있나요?':`${node.count}번 반복 ${count}/${node.count}`} ${more?'예':'아니요'}`,'repeat',()=>{},at);if(!more)break;run(node.body,at,insideFunction,depth+1);count++;}break;}
    case 'stopIfEnd':if(!state.current)fail('NO_SIGNAL','종료 검사 전에 신호를 읽어 주세요.');tick(state.current.kind==='end'?'종료 표지 발견 · 반복 끝내기':'종료 표지가 아니에요','stopIfEnd',()=>{if(state.current.kind==='end')state.stopped=true},at);break;
    case 'call':{if(insideFunction||node.name!=='restore'||!Array.isArray(program.functions?.restore))fail('INVALID_FUNCTION','복원 함수를 연결해 주세요.');needSignal();tick('복원 함수 호출','call',()=>{state.calls++;state.stack.push('복원(신호)')},at);run(program.functions.restore,'function',true,depth+1);tick('복원된 신호 반환','return',()=>{state.stack.pop()},at);break;}
    default:fail('INVALID_PROGRAM','지원하지 않는 명령이에요. 기본 카드로 되돌려 주세요.');
   }
  }
 }
 trace.push({...copy(state),label:'실행 준비','op':'start',path:'',step:0});
 try{
  if(program.functions?.restore){
   const checkFunction=body=>{if(!Array.isArray(body))fail('INVALID_FUNCTION','복원 함수의 구조를 확인해 주세요.');for(const n of body){if(!n||!['rotate','flip','if','lightLast'].includes(n.op))fail('INVALID_FUNCTION','복원 함수에는 신호를 바꾸는 동작만 넣을 수 있어요.');if(n.op==='if')checkFunction(n.body)}};
   checkFunction(program.functions.restore);
  }
  tokens=input.map(parseToken);run(program.body);
 }
 catch(e){error={code:e.code||'INVALID_PROGRAM',message:e.message||'명령을 확인해 주세요.'};}
 return {trace,final:copy(state),error};
}
