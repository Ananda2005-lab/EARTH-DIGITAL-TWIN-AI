const fs = require('fs');
const path = require('path');

const root = process.cwd();
const modulesRoot = path.join(root, 'apps/api/src/modules');
const outRoot = path.join(root, 'postman/collections/Earth Digital Twin AI');
const envRoot = path.join(root, 'postman/environments');

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)],
  );
}
function q(v) { return `'${String(v).replace(/'/g, "''")}'`; }
function safe(s) { return s.replace(/[\\/:*?"<>|]/g, '-').replace(/\s+/g, ' ').trim(); }
function block(s, indent = 0) { const p=' '.repeat(indent); return '|-\n'+String(s).split('\n').map(x=>p+'  '+x).join('\n'); }
function yamlValue(v) { return q(String(v)); }
function findMatchingParen(s, open) { let d=0, quote=null; for(let i=open;i<s.length;i++){const c=s[i]; if(quote){if(c===quote&&s[i-1]!=="\\")quote=null;continue;} if(c==='"'||c==="'"||c==='`'){quote=c;continue;} if(c==='(')d++; else if(c===')'&&--d===0)return i;} return -1; }

const folderNames = {
  health:'Health', auth:'Auth', users:'Users', preferences:'Preferences', search:'Search', countries:'Countries', cities:'Cities', weather:'Weather', environment:'Environment', hazards:'Hazards', flights:'Flights', ships:'Ships', space:'Space', analytics:'Analytics', bookmarks:'Bookmarks', workspaces:'Workspaces', reports:'Reports', notifications:'Notifications', ai:'AI', admin:'Admin', 'admin-system':'Admin System'
};
const variableForParam = { id:'userId', conversationId:'conversationId', bookmarkId:'bookmarkId', workspaceId:'workspaceId', reportId:'reportId', notificationId:'notificationId', cityId:'cityId', code:'countryCode', sessionId:'sessionId', key:'featureFlagKey' };
const sample = {
  countryCode:'IN', cityId:'00000000-0000-4000-8000-000000000001', userId:'00000000-0000-4000-8000-000000000001', conversationId:'00000000-0000-4000-8000-000000000001', bookmarkId:'00000000-0000-4000-8000-000000000001', workspaceId:'00000000-0000-4000-8000-000000000001', reportId:'00000000-0000-4000-8000-000000000001', notificationId:'00000000-0000-4000-8000-000000000001', sessionId:'00000000-0000-4000-8000-000000000001', featureFlagKey:'globe.time_machine'
};

const bodies = {
 RegisterDto:{email:'new.user@earthdigitaltwin.ai',password:'StrongPassword1!',name:'Example User',organisation:'Earth Lab',acceptTerms:true,marketingOptIn:false},
 LoginDto:{email:'{{demoEmail}}',password:'{{demoPassword}}',remember:true}, RefreshDto:{refreshToken:'{{refreshToken}}'},
 ForgotPasswordDto:{email:'{{demoEmail}}'}, ResetPasswordDto:{token:'replace-with-reset-token-at-least-20-chars',password:'NewStrongPassword1!',confirmPassword:'NewStrongPassword1!'}, ChangePasswordDto:{currentPassword:'{{demoPassword}}',password:'NewStrongPassword1!',confirmPassword:'NewStrongPassword1!'}, VerifyEmailDto:{token:'replace-with-verification-token-at-least-20-chars'}, ResendVerificationDto:{email:'{{demoEmail}}'}, MfaCodeDto:{code:'123456'}, UnlinkProviderDto:{provider:'google'},
 UpdateProfileDto:{name:'Demo User',organisation:'Earth Digital Twin'}, RecordHistoryDto:{kind:'search',label:'India climate',center:{lng:78.9629,lat:20.5937},metadata:{}}, ClearHistoryDto:{kind:'search'},
 AiChatDto:{message:'Summarize climate risks for India',conversationId:'{{conversationId}}',context:{location:{name:'India'}}}, AiCompareDto:{targets:[{kind:'country',id:'IN'},{kind:'country',id:'US'}],dimensions:['economy','climate','population']}, RenameConversationDto:{title:'India climate analysis'}, PinConversationDto:{pinned:true},
 CreateBookmarkDto:{name:'New Delhi',kind:'place',center:{lng:77.209,lat:28.6139},tags:['capital'],color:'#38bdf8',pinned:false}, UpdateBookmarkDto:{name:'Updated bookmark',pinned:true}, CreateCollectionDto:{name:'Research',description:'Saved research locations',color:'#818cf8'}, UpdateCollectionDto:{name:'Updated Research'},
 CreateWorkspaceDto:{name:'India Risk Workspace',description:'Hazard monitoring',view:{lng:78.9629,lat:20.5937,altitude:4000000,bearing:0,pitch:0},layers:[],annotations:[],visibility:'private'}, UpdateWorkspaceDto:{description:'Updated workspace'}, AddMemberDto:{email:'colleague@example.com',role:'viewer'}, UpdateMemberDto:{role:'editor'},
 CreateReportDto:{kind:'country',title:'India Climate Risk',target:{id:'IN',name:'India'},tone:'analytical',includeCharts:true}, UpdateReportDto:{title:'Updated India Climate Risk'},
 UpdatePreferencesDto:{theme:'dark',units:'metric',temperatureUnit:'celsius',emailDigest:'weekly',hazardAlertRadiusKm:500},
 AdminUpdateUserDto:{role:'admin'}, FlagAiLogDto:{flagged:true}, PatchCountryDto:{summary:'Curated country summary'}, PatchCityDto:{summary:'Curated city summary'}, FeatureFlagDto:{key:'globe.time_machine',enabled:true,rollout:100}, BroadcastDto:{kind:'system',severity:'info',title:'Platform update',body:'A platform update is available.',audience:'all'}, MaintenanceDto:{enabled:false,message:null}, InvalidateCacheDto:{provider:'weather'}, CreateApiKeyDto:{name:'Local integration',scopes:['read'],rateLimitPerMinute:60,expiresInDays:30}
};
function bodyFor(dto, route, method) {
  if (route === 'auth/register' && method === 'POST') return bodies.RegisterDto;
  if (route === 'auth/login' && method === 'POST') return bodies.LoginDto;
  if (route === 'ai/chat') return bodies.AiChatDto;
  if (route === 'ai/compare') return bodies.AiCompareDto;
  if (bodies[dto]) return bodies[dto];
  if (/preferences/.test(route) && ['PATCH','PUT'].includes(method)) return bodies.UpdatePreferencesDto;
  if (/notifications\/.+read/.test(route)) return {};
  return {};
}
function defaultQueries(route) {
  const q=[];
  if (/search$/.test(route)) q.push(['q','India'],['limit','12']);
  if (/weather\/(current|forecast)/.test(route)||/environment\/(air-quality|.+point)/.test(route)) q.push(['lat','20.5937'],['lng','78.9629'],['units','metric']);
  if (/hazards/.test(route)) q.push(['bbox','68,6,98,38']);
  if (/flights|ships/.test(route)) q.push(['bbox','68,6,98,38']);
  if (/analytics/.test(route)) q.push(['from','2025-01-01'],['to','2025-12-31']);
  if (/(users|reports|bookmarks|workspaces|notifications|conversations|audit|ai-logs)$/.test(route)) q.push(['page','1'],['pageSize','24']);
  return q;
}
function expectedStatus(method, decorators) {
  const hc = decorators.match(/@HttpCode\((?:HttpStatus\.)?([A-Z_]+|\d+)\)/);
  if (hc) { const map={OK:200,CREATED:201,NO_CONTENT:204,ACCEPTED:202}; return map[hc[1]]||Number(hc[1])||200; }
  if (method==='POST') return 201;
  if (method==='DELETE') return 200;
  return 200;
}
function endpointTest(status, raw=false) {
  return `pm.test("Expected HTTP status", function () { pm.expect(pm.response.code).to.eql(${status}); });\n`+
    `if (pm.response.code !== 204) {\n  let json;\n  pm.test("Response body is valid JSON", function () { json = pm.response.json(); pm.expect(json).to.be.an("object"); });\n  pm.test("Response exposes endpoint data", function () { pm.expect(json).to.have.any.keys("data", "status", "message", "id", "items", "tokens"); });\n}`;
}
function authYaml(token) { return `auth:\n  type: bearer\n  credentials:\n    - key: token\n      value: ${q('{{'+token+'}}')}`; }
function makeRequest(ep) {
  let route=ep.route;
  const pathVars=[];
  route=route.replace(/:([A-Za-z][\w]*)/g,(_,p)=>{const v=variableForParam[p]||p; pathVars.push([p,'{{'+v+'}}']);return ':'+p;});
  const queries=defaultQueries(route);
  const dto=(ep.signature.match(/@Body\(\)\s+\w+\s*:\s*([A-Za-z0-9_]+)/)||[])[1];
  const hasBody=!!dto || ['POST','PATCH','PUT'].includes(ep.method) && !/(logout|revoke|rotate|reset|read-all|circuits\/reset)$/.test(route);
  const name=ep.summary || ep.fn.replace(/([a-z])([A-Z])/g,'$1 $2').replace(/^./,c=>c.toUpperCase());
  let y=`$kind: http-request\nname: ${q(name)}\nmethod: ${ep.method}\nurl: ${q('{{baseUrl}}/'+route)}\norder: ${ep.order}\n`;
  if (queries.length) y+='queryParams:\n'+queries.map(([k,v])=>`  - key: ${k}\n    value: ${q(v)}`).join('\n')+'\n';
  if (pathVars.length) y+='pathVariables:\n'+pathVars.map(([k,v])=>`  - key: ${k}\n    value: ${q(v)}`).join('\n')+'\n';
  const token=ep.role==='owner'?'ownerAccessToken':ep.role==='admin'?'adminAccessToken':'accessToken';
  if (!ep.isPublic) y+=authYaml(token)+'\n';
  if (hasBody) { y+='headers:\n  - key: Content-Type\n    value: application/json\nbody:\n  type: json\n  content: '+block(JSON.stringify(bodyFor(dto,route,ep.method),null,2),4)+'\n'; }
  y+='scripts:\n  - type: afterResponse\n    language: text/javascript\n    code: '+block(endpointTest(ep.status),4)+'\n';
  return {name, text:y};
}

const controllers=walk(modulesRoot).filter(f=>f.endsWith('.controller.ts')).sort();
const endpoints=[];
for(const file of controllers){
  const src=fs.readFileSync(file,'utf8');
  const base=(src.match(/@Controller\(\s*['"]([^'"]*)['"]\s*\)/)||[])[1]||'';
  const key=path.basename(file).replace('.controller.ts','');
  const folder=folderNames[key]||folderNames[path.basename(path.dirname(file))]||key;
  const classRole=(src.match(/@Roles\(\s*['"]([^'"]+)['"]\s*\)[\s\S]*?export class/)||[])[1]||'';
  const re=/@(Get|Post|Put|Patch|Delete)\(\s*(?:['"]([^'"]*)['"])?\s*\)/g; let m,order=1000;
  while((m=re.exec(src))){
    const method=m[1].toUpperCase(), sub=m[2]||'';
    const next=src.slice(re.lastIndex);
    const fnMatch=/^\s*(?:async\s+)?([A-Za-z_$][\w$]*)\s*\(/m.exec(next);
    if(!fnMatch) continue;
    const fn=fnMatch[1];
    const open=re.lastIndex+fnMatch.index+fnMatch[0].lastIndexOf('(');
    const close=findMatchingParen(src,open);
    if(close<0) continue;
    const decorators=src.slice(re.lastIndex,re.lastIndex+fnMatch.index);
    const signature=src.slice(open+1,close);
    const summary=(decorators.match(/@ApiOperation\(\{[\s\S]*?summary:\s*['"]([^'"]+)['"]/ )||[])[1];
    const methodRole=(decorators.match(/@Roles\(\s*['"]([^'"]+)['"]/)||[])[1];
    const role=methodRole||classRole||'';
    const isPublic=/@Public\(\)/.test(decorators) || /@Public\(\)/.test(src.slice(Math.max(0,m.index-120),m.index));
    const route=[base,sub].filter(Boolean).join('/');
    endpoints.push({file,folder,method,route,fn,signature,decorators,summary,role,isPublic,status:expectedStatus(method,decorators),order}); order+=1000;
  }
}

fs.rmSync(outRoot,{recursive:true,force:true}); fs.mkdirSync(outRoot,{recursive:true});
const collectionScript=`const max = Number(pm.variables.replaceIn("{{maxResponseTime}}")) || 5000;\npm.test("Response time is within limit", () => pm.expect(pm.response.responseTime).to.be.below(max));\nconst hasBody = pm.response.code !== 204 && pm.response.text().trim().length > 0;\nif (hasBody) {\n  pm.test("Body responses use JSON Content-Type", () => pm.expect(pm.response.headers.get("Content-Type") || "").to.include("application/json"));\n  let json; try { json = pm.response.json(); } catch (_) {}\n  if (json && pm.response.code >= 200 && pm.response.code < 300) {\n    pm.test("Successful API response uses data/meta envelope or documented raw shape", () => {\n      const raw = ["/health", "/auth/oauth/", "/reports/"].some(p => pm.request.url.toString().includes(p));\n      if (!raw) pm.expect(json).to.have.property("data");\n      if (json.data !== undefined) pm.expect(json).to.have.property("meta");\n    });\n  }\n  if (json && pm.response.code >= 400) {\n    const e = json.error || json.data || json;\n    pm.test("Failure has standard error fields", () => ["statusCode","code","message","path","requestId","timestamp"].forEach(k => pm.expect(e).to.have.property(k)));\n  }\n}`;
const before=`if (!pm.environment.get("maxResponseTime")) pm.environment.set("maxResponseTime", "5000");`;
fs.writeFileSync(path.join(outRoot,'collection.yaml'),`$kind: collection\nname: Earth Digital Twin AI\ndescription: ${q('Complete local API and direct AI service request suite derived from project controllers and schemas.')}\nvariables:\n  - key: baseUrl\n    value: ${q('http://localhost:4000/api/v1')}\n  - key: aiServiceUrl\n    value: ${q('http://localhost:8000')}\nscripts:\n  - type: http:beforeRequest\n    language: text/javascript\n    code: ${block(before,4)}\n  - type: http:afterResponse\n    language: text/javascript\n    code: ${block(collectionScript,4)}\n`);

for(const folder of Object.values(folderNames)){fs.mkdirSync(path.join(outRoot,folder),{recursive:true});}
for(const ep of endpoints){const dir=path.join(outRoot,ep.folder);fs.mkdirSync(dir,{recursive:true});const r=makeRequest(ep);let stem=safe(`${ep.order} ${r.name}`);let f=path.join(dir,stem+'.request.yaml'),n=2;while(fs.existsSync(f))f=path.join(dir,`${stem} ${n++}.request.yaml`);fs.writeFileSync(f,r.text);}

function patchAuthScripts(){
 const authDir=path.join(outRoot,'Auth');
 const files=fs.readdirSync(authDir).filter(x=>x.endsWith('.request.yaml'));
 for(const f of files){let s=fs.readFileSync(path.join(authDir,f),'utf8'); if(!/^name: 'Login'$/m.test(s)&&!/^name: 'Refresh/m.test(s))continue;
 const isLogin=/^name: 'Login'$/m.test(s); const code=`let json; try { json = pm.response.json(); } catch (_) { json = {}; }\nconst payload = json.data || json;\nconst tokens = payload.tokens || payload;\nif (tokens.accessToken) pm.environment.set("accessToken", tokens.accessToken);\nif (tokens.refreshToken) pm.environment.set("refreshToken", tokens.refreshToken);\nconst user = payload.user || {};\nif (user.id || payload.userId) pm.environment.set("userId", user.id || payload.userId);`;
 s=s.replace(/scripts:\n/,`scripts:\n  - type: afterResponse\n    language: text/javascript\n    code: ${block(code,4)}\n`);fs.writeFileSync(path.join(authDir,f),s);
 }
}
patchAuthScripts();

function direct(name,method,url,body,auth=true,order=1000){let y=`$kind: http-request\nname: ${q(name)}\nmethod: ${method}\nurl: ${q(url)}\norder: ${order}\n`;if(auth)y+=`headers:\n  - key: Authorization\n    value: ${q('Bearer {{aiServiceToken}}')}\n    disabled: true\n`;if(body)y+=`  - key: Content-Type\n    value: application/json\nbody:\n  type: json\n  content: ${block(JSON.stringify(body,null,2),4)}\n`;y+=`scripts:\n  - type: afterResponse\n    language: text/javascript\n    code: ${block(endpointTest(200,true),4)}\n`;return y;}
const directDir=path.join(outRoot,'AI Service Direct');fs.mkdirSync(directDir,{recursive:true});
fs.writeFileSync(path.join(directDir,'1000 Health.request.yaml'),direct('Health','GET','{{aiServiceUrl}}/health',null,false,1000));
fs.writeFileSync(path.join(directDir,'2000 Chat.request.yaml'),direct('Chat','POST','{{aiServiceUrl}}/v1/chat',{message:'Summarize climate risks for India',context:{location:{name:'India'}},history:[]},true,2000));
fs.writeFileSync(path.join(directDir,'3000 Compare.request.yaml'),direct('Compare','POST','{{aiServiceUrl}}/v1/compare',{targets:[{kind:'country',id:'IN'},{kind:'country',id:'US'}],dimensions:['economy','climate','population']},true,3000));
fs.writeFileSync(path.join(directDir,'4000 Report.request.yaml'),direct('Report','POST','{{aiServiceUrl}}/v1/report',{kind:'country',title:'India Climate Risk',target:{id:'IN',name:'India'},tone:'analytical',includeCharts:true},true,4000));

const negDir=path.join(outRoot,'Auth','Negative Validation');fs.mkdirSync(negDir,{recursive:true});
function negative(name,url,body,status,order,auth){let y=`$kind: http-request\nname: ${q(name)}\nmethod: POST\nurl: ${q(url)}\norder: ${order}\nheaders:\n  - key: Content-Type\n    value: application/json\n`;if(auth)y+=`auth:\n  type: noauth\n`;y+=`body:\n  type: json\n  content: ${block(JSON.stringify(body,null,2),4)}\nscripts:\n  - type: afterResponse\n    language: text/javascript\n    code: ${block(endpointTest(status),4)}\n`;return y;}
fs.writeFileSync(path.join(negDir,'1000 Malformed Register.request.yaml'),negative('Malformed register','{{baseUrl}}/auth/register',{email:'bad',password:'weak',name:'',acceptTerms:false},400,1000));
fs.writeFileSync(path.join(negDir,'2000 Malformed Login.request.yaml'),negative('Malformed login','{{baseUrl}}/auth/login',{email:'not-an-email',password:''},400,2000));
const searchNegDir=path.join(outRoot,'Search','Negative Validation');fs.mkdirSync(searchNegDir,{recursive:true});
fs.writeFileSync(path.join(searchNegDir,'1000 Malformed Coordinates.request.yaml'),`$kind: http-request\nname: 'Malformed coordinates'\nmethod: GET\nurl: ${q('{{baseUrl}}/search')}\norder: 1000\nqueryParams:\n  - key: q\n    value: India\n  - key: near\n    value: 'not-coordinates'\nscripts:\n  - type: afterResponse\n    language: text/javascript\n    code: ${block(endpointTest(400),4)}\n`);
const userNegDir=path.join(outRoot,'Users','Negative Validation');fs.mkdirSync(userNegDir,{recursive:true});
fs.writeFileSync(path.join(userNegDir,'1000 Unauthorized Profile.request.yaml'),`$kind: http-request\nname: 'Unauthorized protected endpoint'\nmethod: GET\nurl: ${q('{{baseUrl}}/users/me')}\norder: 1000\nauth:\n  type: noauth\nscripts:\n  - type: afterResponse\n    language: text/javascript\n    code: ${block(endpointTest(401),4)}\n`);

function env(name, vals){let y=`name: ${q(name)}\nvalues:\n`;for(const [key,value,type='default'] of vals)y+=`  - key: ${key}\n    value: ${q(value)}\n    enabled: true\n    type: ${type}\n`;return y;}
fs.mkdirSync(envRoot,{recursive:true});
const localVals=[['baseUrl','http://localhost:4000/api/v1'],['aiServiceUrl','http://localhost:8000'],['demoEmail','demo@earthdigitaltwin.ai'],['demoPassword','','secret'],['adminEmail','admin@earthdigitaltwin.ai'],['adminPassword','','secret'],['ownerEmail','owner@earthdigitaltwin.ai'],['ownerPassword','','secret'],['accessToken','','secret'],['refreshToken','','secret'],['adminAccessToken','','secret'],['ownerAccessToken','','secret'],['userId',sample.userId],['conversationId',sample.conversationId],['bookmarkId',sample.bookmarkId],['workspaceId',sample.workspaceId],['reportId',sample.reportId],['notificationId',sample.notificationId],['cityId',sample.cityId],['countryCode','IN'],['sessionId',sample.sessionId],['featureFlagKey','globe.time_machine'],['maxResponseTime','5000']];
fs.writeFileSync(path.join(envRoot,'Local Development.yaml'),env('Local Development',localVals));
fs.writeFileSync(path.join(envRoot,'AI Service Local.yaml'),env('AI Service Local',[['aiServiceUrl','http://localhost:8000'],['aiServiceToken','','secret'],['maxResponseTime','5000']]));

console.log(JSON.stringify({controllers:controllers.length,controllerEndpoints:endpoints.length,directAiRequests:4,negativeRequests:4,totalRequests:endpoints.length+8,folders:[...new Set(endpoints.map(e=>e.folder))]},null,2));
