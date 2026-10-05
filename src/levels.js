import {execute} from './engine.js';
const op=op=>({op});
const basic=()=>[op('rotate'),op('flip')];
const guard=()=>({op:'if',condition:'dark',body:[op('lightLast')]});
const normalized=()=>[...basic(),guard()];
export const DEFAULTS={1:{order:['flip','rotate']},2:{loop:'once'},3:{filter:'lit'},4:{guard:'before'},5:{init:'inside',charge:'before'},6:{order:['flip','rotate','guard'],callA:'basic',callB:'basic'},7:{filter:'lit'},8:{init:'inside',filter:'lit',stop:'inside',call:'basic',charge:'before'}};
export const SOLUTIONS={1:{order:['rotate','flip']},2:{loop:'input'},3:{filter:'intact'},4:{guard:'after'},5:{init:'before',charge:'after'},6:{order:['rotate','flip','guard'],callA:'function',callB:'function'},7:{filter:'intact'},8:{init:'before',filter:'intact',stop:'before',call:'function',charge:'after'}};
export const OPTION_SETS={loop:['once','three','input'],filter:['all','lit','intact'],guard:['before','after'],init:['inside','before'],charge:['before','after'],callA:['basic','function'],callB:['basic','function'],call:['basic','function'],stop:['none','inside','before']};
const caseOf=(name,input,outputs,energy=null,position=input.length,channel='A')=>({name,input,outputs,energy,position,channel});
const bits=['000','001','010','011','100','101','110','111'];
const nr=['100','110','001','010','101','111','001','011'];
const allPatterns=energy=>bits.map((b,i)=>caseOf(`정상 ${b}`,[b],[nr[i]],energy?nr[i].split('1').length-1:null));
const normalTests=energy=>[...allPatterns(energy),caseOf('손상 신호만',['!111','!000'],[],energy?0:null),caseOf('입력이 없을 때',[],[],energy?0:null)];
const levels=[
 {id:1,title:'신호의 방향',concept:'순차 실행',district:'관제탑',minutes:3,mission:'회전과 반전의 순서를 바꿔, 목표와 같은 빛을 만드세요.',question:'첫 동작이 끝난 뒤의 신호는 어떤 모습일까요?',note:'읽기와 보내기는 고정돼 있어요. 가운데 두 동작의 순서를 바꿔 보세요.',hints:['100에 첫 칸 반전을 먼저 하면 어떤 신호가 될까요?','회전과 반전은 순서에 따라 결과가 달라져요.','왼쪽으로 한 칸 회전한 뒤 첫 칸을 반전해 보세요.'],guide:'읽기 → 왼쪽 회전 → 첫 칸 반전 → 보내기',cases:[caseOf('첫 신호',['100'],['101']),caseOf('다른 방향',['001'],['110']),caseOf('두 칸이 켜짐',['110'],['001'])]},
 {id:2,title:'끊임없는 도착',concept:'반복',district:'중앙역',minutes:3,mission:'신호가 몇 개 오더라도 같은 장치로 모두 복원하세요.',question:'입력이 한 개일 때도, 네 개일 때도 같은 조건으로 될까요?',note:'읽기부터 보내기까지 한 묶음이에요. 이 묶음을 언제까지 반복할지 정하세요.',hints:['검증 사례에는 신호가 한 개, 네 개, 아예 없는 경우도 있어요.','횟수를 정해 두면 입력 길이가 바뀔 때 문제가 생겨요.','입력이 남아 있는 동안 읽기·복원·보내기를 반복하세요.'],guide:'입력이 남아 있는 동안 { 읽기 → 회전 → 반전 → 보내기 }',cases:[caseOf('신호 세 개',['100','001','110'],['101','110','001']),caseOf('신호 한 개',['011'],['010']),caseOf('빈 회선',[],[]),caseOf('신호 네 개',['100','100','001','110'],['101','101','110','001'])]},
 {id:3,title:'손상 신호 격리',concept:'조건 선택',district:'통신국',minutes:4,mission:'손상 표지가 있는 신호만 제외하고 정상 신호를 보내세요.',question:'000은 손상된 신호일까요, 불이 꺼진 정상 신호일까요?',note:'손상 표지는 ×로 표시돼요. 빛의 모양과 손상 여부는 별개예요.',hints:['정상 000도 읽을 수 있는 데이터예요.','켜진 칸의 개수로 손상 여부를 판단하면 안 돼요.','손상 표지가 없을 때만 복원하고 보내세요.'],guide:'읽기 → 손상 표지가 없으면 { 기본 복원 → 보내기 }',cases:[caseOf('섞여 들어온 신호',['100','!001','000'],['101','100']),caseOf('모두 손상',['!100','!000'],[]),caseOf('복원 후 암전',['010'],['000']),caseOf('빈 회선',[],[])]},
 {id:4,title:'암전 방지 회로',concept:'조건의 위치',district:'도서관',minutes:4,mission:'복원 결과가 모두 꺼졌을 때만 마지막 칸을 켜세요.',question:'조건은 원래 신호를 봐야 할까요, 복원된 신호를 봐야 할까요?',note:'보정 규칙은 “세 칸이 모두 꺼졌으면 마지막 칸 켜기”예요. 검사 위치를 선택하세요.',hints:['010을 기본 복원하면 000이 돼요.','처리 전과 처리 후의 신호는 같지 않아요.','회전·반전을 마친 다음 암전 여부를 검사하세요.'],guide:'기본 복원 → 모두 꺼졌으면 마지막 칸 켜기 → 보내기',cases:[caseOf('암전 보정',['010','000'],['001','100']),...normalTests(false),caseOf('손상은 보정하지 않기',['!010','010'],['001'])]},
 {id:5,title:'도시 충전기',concept:'상태와 누적',district:'발전소',minutes:5,mission:'보낸 신호의 켜진 칸 수를 모두 더해 도시를 충전하세요.',question:'두 번째 신호를 처리할 때 첫 신호의 충전량이 남아 있나요?',note:'충전량을 0으로 만드는 위치와, 켜진 칸을 세는 위치를 골라 보세요.',hints:['여러 신호의 충전량을 더한 값이 남아야 해요.','반복할 때마다 0으로 만들면 이전 결과가 사라져요.','반복 전에 0으로, 복원한 뒤 켜진 칸 수만큼 더하세요.'],guide:'처음에 충전량 0 → 정상 신호마다 보정 복원 → 켜진 칸 수 누적 → 보내기',cases:[caseOf('도시 충전',['100','001','010'],['101','110','001'],5),caseOf('꺼진 정상 신호',['000'],['100'],1),caseOf('빈 회선',[],[],0),caseOf('손상 신호',['!111'],[],0)]},
 {id:6,title:'복원 모듈 만들기',concept:'함수와 추상화',district:'연구소',minutes:5,mission:'두 회선이 똑같은 복원 함수를 사용하도록 연결하세요.',question:'복원 규칙이 바뀌면 어디를 한 번만 고치면 될까요?',note:'함수 안에 회전·반전·암전 보정을 넣고, A와 B 회선에서 같은 함수를 호출하세요.',hints:['함수 안에는 신호를 복원하는 동작만 넣어요.','함수를 만들어도 회선에서 호출하지 않으면 사용되지 않아요.','함수 순서는 회전 → 반전 → 암전 보정. A와 B 모두 함수 호출로 연결하세요.'],guide:'복원 함수 = 회전 → 반전 → 암전 보정. 두 회선에서 같은 함수 호출',cases:[caseOf('회선 A',['100','010'],['101','001'],3,2,'A'),caseOf('회선 B',['000','101'],['100','111'],4,2,'B'),...normalTests(true).map(c=>({...c,channel:'A'})),caseOf('빈 회선 B',[],[],0,0,'B')]},
 {id:7,title:'통과한 코드의 함정',concept:'반례와 디버깅',district:'관측소',minutes:5,mission:'오류를 드러내는 입력을 찾아 실행한 뒤, 잘못된 조건을 고치세요.',question:'예제 하나를 통과하면 모든 입력에서도 맞는 걸까요?',note:'현재 조건은 “정상이고 켜진 칸 있음”이에요. 먼저 반례 검사로 이 조건의 문제를 드러내세요.',hints:['기본 예제 100과 001에서는 오류가 보이지 않아요.','손상 표지가 없는 000도 복원해야 해요.','정상 000으로 원래 오류를 확인한 뒤, 조건을 손상 표지가 없음으로 바꾸세요.'],guide:'정상 000을 반례로 검사 → 필터를 손상 표지 없음으로 수정',cases:[caseOf('겉보기에는 성공',['100','001'],['101','110'],4),...normalTests(true)]},
 {id:8,title:'마지막 전송',concept:'통합과 종료',district:'도시 전역',minutes:7,mission:'종료 표지 앞의 정상 신호만 복원하고, 다음 전송분은 남겨 두세요.',question:'종료 표지와 그 뒤 신호는 각각 어디까지 처리해야 할까요?',note:'종료 표지는 읽어서 확인하지만 충전하거나 출력하지 않아요. 종료 표지가 없으면 입력이 끝날 때 멈춰요.',hints:['종료 표지는 손상도 정상 신호도 아닌 별도의 표지예요.','정상 신호 조건 안에 종료 검사를 넣으면 그 표지를 놓칠 수 있어요.','시작 전 0 → 읽은 직후 종료 검사 → 정상만 함수로 복원 → 복원 후 충전·출력'],guide:'처음에 충전량 0 → 반복 { 읽기 → 종료면 멈춤 → 정상만 함수 호출·충전·보내기 }',cases:[caseOf('마지막 전송',['100','!111','010','END','101'],['101','001'],3,4),caseOf('첫 항목이 종료',['END','100'],[],0,1),caseOf('꺼진 신호 뒤 종료',['000','END'],['100'],1,2),caseOf('종료 표지 없음',['101','001'],['111','110'],5),caseOf('빈 전송',[],[],0),caseOf('종료 뒤 손상도 남기기',['100','END','!111','000'],['101'],2,2)]}
];
export const LEVELS=levels;
export function getLevel(id){const level=levels.find(l=>l.id===Number(id));if(!level)throw new Error('단계를 찾을 수 없어요.');return level;}
export function cleanConfig(id,candidate={}){candidate=candidate&&typeof candidate==='object'&&!Array.isArray(candidate)?candidate:{};const defaults=DEFAULTS[id];if(!defaults)throw new Error('잘못된 단계');const cfg={};for(const [key,value] of Object.entries(defaults)){if(key==='order'){const order=candidate.order;cfg.order=Array.isArray(order)&&order.length===value.length&&new Set(order).size===value.length&&order.every(x=>value.includes(x))?[...order]:[...value];}else cfg[key]=OPTION_SETS[key]?.includes(candidate[key])?candidate[key]:value;}return cfg;}
export function buildProgram(id,config,channel='A'){
 getLevel(id);const c=cleanConfig(id,config);if(JSON.stringify(c)!==JSON.stringify(config))throw new Error('카드 설정을 확인해 주세요.');
 if(id===1)return {body:[op('read'),...c.order.map(op),op('emit')]};
 let transform=id<4?basic():normalized();let filter=id===3?c.filter:id===7||id===8?c.filter:'intact';
 if(id===4)transform=c.guard==='after'?normalized():[guard(),...basic()];
 const fn=id===6?c.order.flatMap(n=>n==='guard'?[guard()]:[op(n)]):normalized();
 if(id===6)transform=c[`call${channel}`]==='function'?[{op:'call',name:'restore'}]:basic();
 if(id===7)transform=[{op:'call',name:'restore'}];
 if(id===8)transform=c.call==='function'?[{op:'call',name:'restore'}]:basic();
 let inside=[...transform,op('emit')];
 if(id>=5)inside=c.charge==='before'?[op('charge'),...transform,op('emit')]:[...transform,op('charge'),op('emit')];
 if(id===8&&c.stop==='inside')inside.unshift(op('stopIfEnd'));
 const iteration=[op('read')];
 if(id>=5&&c.init==='inside')iteration.unshift(op('init'));
 if(id===8&&c.stop==='before')iteration.push(op('stopIfEnd'));
 iteration.push(...(id===2?inside:[{op:'if',condition:filter,body:inside}]));
 let body=id===2&&c.loop==='once'?iteration:[{op:'repeat',mode:id===2&&c.loop==='three'?'count':'input',count:3,body:iteration}];
 if(id>=5&&(c.init!=='inside'))body.unshift(op('init'));
 return {body,functions:{restore:fn}};
}
export function validateLevel(id,config,proof=false){
 const level=getLevel(id);let results=[];
 try{results=level.cases.map(c=>{const run=execute(buildProgram(id,config,c.channel),c.input);const output=JSON.stringify(run.final.outputs)===JSON.stringify(c.outputs);const energy=c.energy===null||run.final.energy===c.energy;const position=run.final.position===c.position;const called=id!==6||c.outputs.length===0||run.final.calls>0;return {name:c.name,passed:!run.error&&output&&energy&&position&&called,output,energy,position,called,expected:c,run};});}
 catch(e){return {passed:false,results,requirement:e.message};}
 const requirement=id===7&&!proof?'먼저 정상 000으로 원래 코드의 오류를 확인하세요.':null;
 return {passed:!requirement&&results.every(r=>r.passed),results,requirement};
}
