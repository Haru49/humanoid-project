/** Commands waiting in JS are invalidated by STOP/RELEASE or a link change. */
export function createCommandQueue() {
  let epoch=0, pending=Promise.resolve();
  return {
    cancel(){epoch++;},
    send(action: ()=>Promise<void>, priority=false) {
      if(priority){epoch++;return action();}
      const requested=epoch;
      pending=pending.catch(()=>undefined).then(()=>{
        if(requested!==epoch)throw new Error('Command cancelled');
        return action();
      });
      return pending;
    },
  };
}
