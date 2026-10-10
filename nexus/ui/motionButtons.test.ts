// @ts-nocheck
import {it,expect,vi} from 'vitest';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

it('telemetry preserves pressed buttons and permits one click to send UP',async()=>{
  class Element {
    dataset={};children=[];textContent='';disabled=false;hidden=false;
    classList={toggle:vi.fn()};
    append(...nodes){this.children.push(...nodes);}
    replaceChildren(...nodes){this.children=nodes;}
    get lastElementChild(){return this.children.at(-1);}
    closest(){return this;}
  }
  const elements=Object.fromEntries(['acts','prog','mstate'].map(id=>[id,new Element()]));
  const command=vi.fn().mockResolvedValue(undefined);
  const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
  const source=html.slice(html.indexOf('const programs ='),html.indexOf('/* ================= tools rail'));
  const context={document:{createElement:()=>new Element()},$:id=>elements[id],
    connected:true,deviceState:'idle',joints:[],backend:{command},log:vi.fn()};
  runInNewContext(source+'\nrenderActs();globalThis.update=renderActs;',context);
  const pressed=elements.acts.children[1];
  for(let i=0;i<100;i++)context.update();
  expect(elements.acts.children[1]).toBe(pressed);
  expect(pressed.disabled).toBe(false);
  await elements.acts.onclick({target:pressed});
  expect(command).toHaveBeenCalledExactlyOnceWith('SQUAT UP');
  for(const [program,expected] of [['left','STEP LEFT'],['right','STEP RIGHT'],['step','STEP AUTO'],['walk','WALK LEFT'],['walkright','WALK RIGHT'],['walkauto','WALK AUTO']]) {
    runInNewContext(`prog='${program}';renderActs();`,context);
    const lift=elements.acts.children[0];
    expect(lift.disabled).toBe(false);
    await elements.acts.onclick({target:lift});
    expect(command).toHaveBeenLastCalledWith(expected);
  }
  runInNewContext("prog='walkright';renderActs();",context);
  await elements.acts.onclick({target:elements.acts.children[1]});
  expect(command).toHaveBeenLastCalledWith('SQUAT UP');
  runInNewContext("prog='squat';renderActs();",context);
  context.deviceState='fault';context.update();
  expect(elements.acts.children[1].disabled).toBe(true);
});
