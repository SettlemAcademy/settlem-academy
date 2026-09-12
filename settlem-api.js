const SETTLEM_API=(localStorage.getItem("settlemApiUrl")||"http://localhost:4000").replace(/\/$/,"")+"/api";function getToken(){return localStorage.getItem("settlemAuthToken")}async function api(path,o={}){const h={"Content-Type":"application/json",...(o.headers||{})};if(getToken())h.Authorization="Bearer "+getToken();const x=await fetch(SETTLEM_API+path,{...o,headers:h}),d=await x.json().catch(()=>({}));if(!x.ok)throw Error(d.error||"Request failed");return d}async function apiMe(){return api("/me")}async function apiLiveClasses(){return api("/live-classes")}async function apiCreateLiveClass(p){return api("/live-classes",{method:"POST",body:JSON.stringify(p)})}async function apiDeleteLiveClass(id){return api("/live-classes/"+id,{method:"DELETE"})}
async function apiMarkAttendance(id){return api("/live-classes/"+id+"/attendance",{method:"POST"});}
async function apiStudentAnalytics(){return api("/analytics/student");}
async function apiAdminAnalytics(){return api("/analytics/admin");}
async function apiAnnouncements(){return api("/announcements");}
async function apiCreateAnnouncement(payload){return api("/announcements",{method:"POST",body:JSON.stringify(payload)});}
async function apiDeleteAnnouncement(id){return api("/announcements/"+id,{method:"DELETE"});}

async function apiLeaderboard(){return api("/leaderboard");}
async function apiCourseLeaderboard(course){return api("/leaderboard/course?course="+encodeURIComponent(course));}
async function apiMyPoints(){return api("/points/me");}

async function apiProfile(){return api("/profile");}
async function apiUpdateProfile(payload){return api("/profile",{method:"PUT",body:JSON.stringify(payload)});}
async function apiChangePassword(payload){return api("/profile/password",{method:"PUT",body:JSON.stringify(payload)});}
