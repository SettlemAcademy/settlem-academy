(function(){
  const DEFAULT_API='https://settlem-academy-1.onrender.com';
  function apiBase(){return (localStorage.getItem('settlemApiUrl')||DEFAULT_API).replace(/\/$/,'');}
  function normalizePath(path){
    path=String(path||'');
    if(/^https?:\/\//i.test(path)) return path;
    return path.startsWith('/api/') ? path : '/api'+(path.startsWith('/')?path:'/'+path);
  }
  function hasSession(){return !!localStorage.getItem('settlemAuthToken');}
  function hasLocalSession(){return localStorage.getItem('settlemLoggedIn')==='true';}
  async function api(path,options={}){
    const headers={'Content-Type':'application/json',...(options.headers||{})};
    const token=localStorage.getItem('settlemAuthToken');
    if(token) headers.Authorization='Bearer '+token;
    const res=await fetch(/^https?:\/\//i.test(String(path||''))?path:apiBase()+normalizePath(path),{...options,headers});
    let data={}; try{data=await res.json()}catch(e){}
    if(!res.ok){
      if(res.status===401){
        localStorage.removeItem('settlemAuthToken');
        throw new Error(data.error||'Your secure session has expired. Please log in again.');
      }
      throw new Error(data.error||'Request failed');
    }
    return data;
  }
  async function apiLogin(email,password){return api('/auth/login',{method:'POST',body:JSON.stringify({email,password})});}
  window.SettlemAPI={base:apiBase,request:api,login:apiLogin,hasSession,hasLocalSession};
})();
