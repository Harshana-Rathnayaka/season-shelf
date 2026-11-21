const {randomUUID} = require('node:crypto');
const {hasSecureStorage} = require('./secure-storage.cjs');
exports.loginMemory = (store,safeStorage,platform = process.platform) => {
  const read=()=>{
    const value=store.get('loginSuggestions',null);
    if(!value || !hasSecureStorage(safeStorage,platform)) return [];
    try{return JSON.parse(safeStorage.decryptString(Buffer.from(value,'base64')));}catch{return [];}
  };
  const write=entries=>{
    if(!hasSecureStorage(safeStorage,platform)) return;
    store.set('loginSuggestions',safeStorage.encryptString(JSON.stringify(entries)).toString('base64'));
  };
  return {
    save({apiId,apiHash,phone}) {
      if(!apiId || !apiHash || !phone) return;
      write([{id:randomUUID(),apiId,apiHash,phone},...read().filter(item=>item.phone!==phone || item.apiId!==apiId)].slice(0,5));
    },
    list:()=>read().map(({id,apiId,phone})=>({id,apiId,phone:`•••${phone.slice(-4)}`})),
    get(id){const value=read().find(item=>item.id===id);if(!value)throw new Error('Saved details are unavailable');return value;},
    forget:()=>store.set('loginSuggestions',null),
  };
};
