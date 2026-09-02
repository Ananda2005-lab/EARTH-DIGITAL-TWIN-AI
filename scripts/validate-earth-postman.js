const fs = require('fs');
const path = require('path');
const yaml = require('yaml');
function walk(d){return fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(d,e.name)):[path.join(d,e.name)]);}
const root='postman/collections/Earth Digital Twin AI';
const files=[...walk(root),...walk('postman/environments')].filter(f=>/\.ya?ml$/i.test(f));
const errors=[];
for(const f of files){try{yaml.parse(fs.readFileSync(f,'utf8'));}catch(e){errors.push(`${f}: ${e.message}`);}}
const req=walk(root).filter(f=>f.endsWith('.request.yaml'));
const duplicates=[];
for(const dir of [...new Set(req.map(path.dirname))]){
  const seen=new Set();
  for(const f of req.filter(x=>path.dirname(x)===dir)){
    const n=yaml.parse(fs.readFileSync(f,'utf8')).name;
    if(seen.has(n))duplicates.push(`${dir}: ${n}`); seen.add(n);
  }
}
const reserved=/^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(\.|$)/i;
const unsafe=req.filter(f=>/[<>:"|?*]/.test(path.basename(f))||reserved.test(path.basename(f)));
console.log(JSON.stringify({yamlFiles:files.length,yamlErrors:errors,requests:req.length,duplicateNames:duplicates,unsafeFilenames:unsafe},null,2));
if(errors.length||duplicates.length||unsafe.length)process.exit(1);
