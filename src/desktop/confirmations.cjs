const {randomUUID} = require('node:crypto');
exports.createConfirmations = ({handle,notify}) => {
  let pending;
  handle('confirmation-reply', ({id,response}) => {
    if (!pending || pending.id !== id) throw new Error('Confirmation expired');
    if (!Number.isInteger(response) || response < 0 || response >= pending.count) throw new Error('Invalid choice');
    pending.finish(response);
    return {};
  });
  return options => new Promise((resolve,reject) => {
    if (pending) {reject(new Error('Finish the open confirmation first'));return;}
    const id=randomUUID();
    const timer=setTimeout(()=>pending?.id===id && pending.finish(options.cancelId ?? 0),120000);
    pending={id,count:options.buttons.length,finish(response){clearTimeout(timer);pending=null;resolve({response});}};
    notify('confirmation',{id,title:options.title,message:options.message,detail:options.detail,buttons:options.buttons});
  });
};
