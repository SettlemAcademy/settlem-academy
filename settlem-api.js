const SETTLEM_API = (localStorage.getItem("settlemApiUrl") || "https://settlem-academy-1.onrender.com").replace(/\/$/, "") + "/api";

function getToken(){ return localStorage.getItem("settlemAuthToken"); }
function clearAuth(){ localStorage.removeItem("settlemAuthToken"); localStorage.removeItem("settlemAcademyUser"); }
async function api(path, options={}){
  const headers = {"Content-Type":"application/json", ...(options.headers||{})};
  const token = getToken();
  if(token) headers.Authorization = "Bearer " + token;
  const response = await fetch(SETTLEM_API + path, {...options, headers});
  const data = await response.json().catch(()=>({}));
  if(!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
  return data;
}
async function apiStatus(){ return api("/health"); }
async function apiMe(){ return api("/me"); }
async function apiLogin(email,password){ return api("/auth/login",{method:"POST",body:JSON.stringify({email,password})}); }
async function apiRegister(name,email,password){ return api("/auth/register",{method:"POST",body:JSON.stringify({name,email,password})}); }
async function apiDashboard(){ return api("/dashboard"); }
async function apiCourses(){ return api("/courses"); }
async function apiEnroll(course){ return api("/courses/enroll",{method:"POST",body:JSON.stringify({course})}); }
async function apiVideos(course=""){ return api("/videos" + (course?"?course="+encodeURIComponent(course):"")); }
async function apiMaterials(course="",type=""){ const q=[]; if(course)q.push("course="+encodeURIComponent(course)); if(type)q.push("type="+encodeURIComponent(type)); return api("/materials"+(q.length?"?"+q.join("&"):"")); }
async function apiTests(){ return api("/tests"); }
async function apiTest(id){ return api("/tests/"+encodeURIComponent(id)); }
async function apiSubmitTest(id,answers){ return api("/tests/"+encodeURIComponent(id)+"/submit",{method:"POST",body:JSON.stringify({answers})}); }
async function apiProgress(payload){ return api("/progress",{method:"POST",body:JSON.stringify(payload)}); }
async function apiAdminStudents(){ return api("/admin/students"); }
async function apiAdminVideos(){ return apiVideos(); }
async function apiAdminAddVideo(payload){ return api("/videos",{method:"POST",body:JSON.stringify(payload)}); }
async function apiAdminMaterials(){ return apiMaterials(); }
async function apiAdminAddMaterial(payload){ return api("/materials",{method:"POST",body:JSON.stringify(payload)}); }
async function apiLiveClasses(){ return api("/live-classes"); }
async function apiCreateLiveClass(payload){ return api("/live-classes",{method:"POST",body:JSON.stringify(payload)}); }
async function apiDeleteLiveClass(id){ return api("/live-classes/"+encodeURIComponent(id),{method:"DELETE"}); }
async function apiMarkAttendance(id){ return api("/live-classes/"+encodeURIComponent(id)+"/attendance",{method:"POST"}); }
async function apiStudentAnalytics(){ return api("/analytics/student"); }
async function apiAdminAnalytics(){ return api("/analytics/admin"); }
async function apiAnnouncements(){ return api("/announcements"); }
async function apiCreateAnnouncement(payload){ return api("/announcements",{method:"POST",body:JSON.stringify(payload)}); }
async function apiDeleteAnnouncement(id){ return api("/announcements/"+encodeURIComponent(id),{method:"DELETE"}); }
async function apiLeaderboard(){ return api("/leaderboard"); }
async function apiCourseLeaderboard(course){ return api("/leaderboard/course?course="+encodeURIComponent(course)); }
async function apiMyPoints(){ return api("/points/me"); }
async function apiProfile(){ return api("/profile"); }
async function apiUpdateProfile(payload){ return api("/profile",{method:"PUT",body:JSON.stringify(payload)}); }
async function apiChangePassword(payload){ return api("/profile/password",{method:"PUT",body:JSON.stringify(payload)}); }
async function apiStoreCourses(){ return api("/store/courses"); }
async function apiCreatePaymentOrder(payload){ return api("/payments/order",{method:"POST",body:JSON.stringify(payload)}); }
async function apiVerifyPayment(payload){ return api("/payments/verify",{method:"POST",body:JSON.stringify(payload)}); }
async function apiPayments(){ return api("/payments"); }
async function apiCertificates(){ return api("/certificates"); }
async function apiRequestCertificate(payload){ return api("/certificates",{method:"POST",body:JSON.stringify(payload||{})}); }
async function apiAchievements(){ return api("/achievements"); }
async function apiCheckAchievements(){ return api("/achievements/check",{method:"POST"}); }
async function apiAdminTeachers(){ return api("/admin/teachers"); }
async function apiAdminCreateTeacher(payload){ return api("/admin/teachers",{method:"POST",body:JSON.stringify(payload)}); }
async function apiAdminDeleteTeacher(id){ return api("/admin/teachers/"+encodeURIComponent(id),{method:"DELETE"}); }
async function apiTeacherDashboard(){ return api("/teacher/dashboard"); }
async function apiAdminTests(){ return api("/tests"); }
async function apiAdminCreateTest(payload){ return api("/tests",{method:"POST",body:JSON.stringify(payload)}); }
function requireAdminPage(){
  if(!getToken()){ location.href="admin-login.html"; return false; }
  return true;
}
function adminLogout(){ clearAuth(); location.href="admin-login.html"; }
