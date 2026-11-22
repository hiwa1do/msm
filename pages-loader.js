
async function startPagesBuild(module, status) {
  if (!crossOriginIsolated) {
    if (!navigator.serviceWorker) throw Error('Open this build over HTTPS to enable game workers.');
    if (sessionStorage.getItem('msm-isolation-reload')) {
      sessionStorage.removeItem('msm-isolation-reload');
      throw Error('Could not enable game workers. Reload the page to retry.');
    }
    status('Enabling game workers...');
    await navigator.serviceWorker.register('./isolate.js');
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) {
      await new Promise((resolve,reject) => {
        const ready = () => {clearTimeout(timer); resolve();};
        const timer = setTimeout(() => {
          navigator.serviceWorker.removeEventListener('controllerchange',ready);
          reject(Error('Game workers could not start. Reload to retry.'));
        },10000);
        navigator.serviceWorker.addEventListener('controllerchange',ready,{once:true});
        if (navigator.serviceWorker.controller) ready();
      });
    }
    sessionStorage.setItem('msm-isolation-reload','1');
    location.reload();
    await new Promise(() => {});
  }
  sessionStorage.removeItem('msm-isolation-reload');
  async function json(path) {
    const response = await fetch(path);
    if (!response.ok) throw Error('Could not load '+path);
    return response.json();
  }
  const [config, manifest] = await Promise.all([json('./transport-config.json'),json('./engine/parts.json')]);
  let relay;
  try { relay = new URL(config.transportUrl); } catch {}
  const loopback = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
  if (!relay || !(relay.protocol === 'wss:' || (loopback && relay.protocol === 'ws:'))) {
    throw Error('Set the game relay URL in transport-config.json.');
  }
  module.arcTransportUrl = relay.href;
  module.arcTransportToken = config.token || '';

  async function getPart(name, size) {
    const response = await fetch('./engine/'+name);
    if (!response.ok) throw Error('Could not load '+name+' (HTTP '+response.status+')');
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.length !== size) throw Error('Wrong file size for '+name);
    return bytes;
  }
  module.fetchPagesData = async size => {
    const entries = manifest['arc_boot.data'];
    const data = new Uint8Array(size);
    let next=0, offset=0, loaded=0;
    const work=entries.map(([name,length])=>{
      const item={name,length,offset};
      offset+=length;
      return item;
    });
    if (offset !== size) throw Error('The data manifest does not match this engine.');
    await Promise.all(Array.from({length:4},async()=>{
      while(next<work.length){
        const {name,length,offset}=work[next++];
        data.set(await getPart(name,length),offset);
        loaded+=length;
        status('Loading game data '+Math.floor(100*loaded/size)+'%');
      }
    }));
    return data.buffer;
  };
  module.fetchPagesWasm = async () => {
    const entries=manifest['arc_boot.wasm'];
    let next=0;
    return new Response(new ReadableStream({
      async pull(controller){
        if(next===entries.length){controller.close();return;}
        const [name,size]=entries[next++];
        try{controller.enqueue(await getPart(name,size));}
        catch(error){controller.error(error);}
      }
    }),{headers:{'Content-Type':'application/wasm'}});
  };
}
