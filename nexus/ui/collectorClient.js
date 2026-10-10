/** Shared transport for the v8 HTML UI. No USB ownership or automatic motion. */
export function createBackendClient(onLive, onError, transport = {}) {
  const request=transport.fetch??globalThis.fetch.bind(globalThis);
  const Stream=transport.EventSource??globalThis.EventSource;
  let token='',latest=null,stream=null;
  const waiters=new Set();
  function accept(value){latest=value;onLive(value);for(const check of waiters)check();}
  async function get(path){
    const response=await request('/api/telemetry/'+path);
    if(!response.ok)throw new Error(`収集サービスに接続できません (${response.status})`);
    return response.json();
  }
  async function post(path,body={}){
    if(!token)token=(await get('control')).token;
    const response=await request('/api/telemetry/'+path,{method:'POST',headers:{'Content-Type':'application/json','X-Nexus-Control':token},body:JSON.stringify(body)});
    const value=await response.json();
    if(!response.ok){if(response.status===403)token='';throw new Error(value.error??'操作失敗');}
    accept(value);return value;
  }
  return {
    get,post,
    async command(command){if(!latest?.sessionId)throw new Error('ESP32未接続');return post('command',{command,sessionId:latest.sessionId});},
    waitForState(state){
      const session=latest?.sessionId;
      return new Promise((resolve,reject)=>{
        const cleanup=()=>{clearTimeout(timer);waiters.delete(check);};
        const check=()=>{if(latest?.sessionId!==session){cleanup();reject(new Error('接続が変更されました'));}else if(latest?.motion.state===state){cleanup();resolve();}};
        const timer=setTimeout(()=>{cleanup();reject(new Error('装置の状態確認に失敗しました'));},3000);
        waiters.add(check);check();
      });
    },
    start(){
      stream=new Stream('/api/telemetry/stream');
      stream.onmessage=e=>{try{accept(JSON.parse(e.data));}catch(error){onError(error.message);}};
      stream.onerror=()=>{token='';onError('収集サービスとの接続が切れました');};
      return stream;
    },
    close(){stream?.close();stream=null;},
  };
}
