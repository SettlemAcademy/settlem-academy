require("dotenv").config();
const express=require("express");
const cors=require("cors");
const bcrypt=require("bcryptjs");
const jwt=require("jsonwebtoken");
const Database=require("better-sqlite3");

const app=express();
const db=new Database("settlem-academy.db");
const PORT=process.env.PORT||4000;
const JWT_SECRET=process.env.JWT_SECRET||"CHANGE_THIS_SECRET";

app.use(cors({origin:process.env.FRONTEND_ORIGIN||true}));
app.use(express.json());

db.pragma("foreign_keys=ON");
db.exec(`
CREATE TABLE IF NOT EXISTS users(
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 name TEXT NOT NULL,
 email TEXT NOT NULL UNIQUE,
 password_hash TEXT NOT NULL,
 role TEXT NOT NULL DEFAULT 'student',
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS enrollments(
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 course TEXT NOT NULL,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(user_id,course)
);
CREATE TABLE IF NOT EXISTS videos(
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 title TEXT NOT NULL,
 course TEXT NOT NULL,
 module TEXT NOT NULL,
 youtube_url TEXT NOT NULL,
 video_id TEXT NOT NULL,
 description TEXT DEFAULT '',
 published INTEGER NOT NULL DEFAULT 1,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS materials(
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 title TEXT NOT NULL,
 course TEXT NOT NULL,
 type TEXT NOT NULL,
 url TEXT NOT NULL,
 description TEXT DEFAULT '',
 published INTEGER NOT NULL DEFAULT 1,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS tests(
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 title TEXT NOT NULL,
 course TEXT NOT NULL,
 instructions TEXT DEFAULT '',
 published INTEGER NOT NULL DEFAULT 0,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS questions(
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 test_id INTEGER NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
 question TEXT NOT NULL,
 option_a TEXT NOT NULL,
 option_b TEXT NOT NULL,
 option_c TEXT NOT NULL,
 option_d TEXT NOT NULL,
 correct_index INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS lesson_progress(
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 course TEXT NOT NULL,
 module_index INTEGER NOT NULL,
 completed INTEGER NOT NULL DEFAULT 0,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(user_id,course,module_index)
);
CREATE TABLE IF NOT EXISTS test_results(
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 test_id INTEGER NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
 score INTEGER NOT NULL,
 correct INTEGER NOT NULL,
 total INTEGER NOT NULL,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS live_classes(
 id INTEGER PRIMARY KEY AUTOINCREMENT, teacher_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, title TEXT NOT NULL, course TEXT NOT NULL, scheduled_at TEXT NOT NULL, duration_minutes INTEGER NOT NULL DEFAULT 60, meeting_url TEXT NOT NULL, description TEXT DEFAULT '', status TEXT NOT NULL DEFAULT 'scheduled', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS attendance(
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 live_class_id INTEGER NOT NULL REFERENCES live_classes(id) ON DELETE CASCADE,
 user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 joined_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(live_class_id,user_id)
);
CREATE TABLE IF NOT EXISTS user_points(
 user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, xp INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS announcements(
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 author_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 title TEXT NOT NULL,
 message TEXT NOT NULL,
 course TEXT,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
`);

try{db.exec("ALTER TABLE users ADD COLUMN phone TEXT DEFAULT ''");}catch(e){}
try{db.exec("ALTER TABLE users ADD COLUMN avatar_url TEXT DEFAULT ''");}catch(e){}
try{db.exec("ALTER TABLE users ADD COLUMN bio TEXT DEFAULT ''");}catch(e){}

function tokenFor(user){return jwt.sign({id:user.id,role:user.role},JWT_SECRET,{expiresIn:"7d"})}
function auth(req,res,next){
 const h=req.headers.authorization||"";
 if(!h.startsWith("Bearer "))return res.status(401).json({error:"Authentication required"});
 try{req.user=jwt.verify(h.slice(7),JWT_SECRET);next()}catch(e){return res.status(401).json({error:"Invalid or expired token"})}
}
function admin(req,res,next){if(req.user.role!=="admin")return res.status(403).json({error:"Admin access required"});next()}

app.get("/api/health",(req,res)=>res.json({ok:true,service:"Settlem Academy API"}));

app.post("/api/auth/register",(req,res)=>{
 const {name,email,password}=req.body||{};
 if(!name||!email||!password||password.length<6)return res.status(400).json({error:"Name, email and a 6+ character password are required"});
 try{
  const hash=bcrypt.hashSync(password,12);
  const info=db.prepare("INSERT INTO users(name,email,password_hash) VALUES(?,?,?)").run(name.trim(),email.trim().toLowerCase(),hash);
  const user=db.prepare("SELECT id,name,email,role FROM users WHERE id=?").get(info.lastInsertRowid);
  res.status(201).json({token:tokenFor(user),user});
 }catch(e){res.status(409).json({error:"An account with this email already exists"})}
});

app.post("/api/auth/login",(req,res)=>{
 const {email,password}=req.body||{};
 const u=db.prepare("SELECT * FROM users WHERE email=?").get((email||"").trim().toLowerCase());
 if(!u||!bcrypt.compareSync(password||"",u.password_hash))return res.status(401).json({error:"Invalid email or password"});
 const user={id:u.id,name:u.name,email:u.email,role:u.role};
 res.json({token:tokenFor(user),user});
});

app.get("/api/me",auth,(req,res)=>{
 const u=db.prepare("SELECT id,name,email,role,created_at FROM users WHERE id=?").get(req.user.id);
 res.json(u||{});
});

app.get("/api/profile",auth,(req,res)=>{
 const u=db.prepare("SELECT id,name,email,role,phone,avatar_url,bio,created_at FROM users WHERE id=?").get(req.user.id);
 res.json(u||{});
});
app.put("/api/profile",auth,(req,res)=>{
 const {name,phone,avatar_url,bio}=req.body||{};
 if(!name||name.trim().length<2)return res.status(400).json({error:"Name is required"});
 db.prepare("UPDATE users SET name=?,phone=?,avatar_url=?,bio=? WHERE id=?").run(name.trim(),(phone||"").trim(),(avatar_url||"").trim(),(bio||"").trim(),req.user.id);
 res.json(db.prepare("SELECT id,name,email,role,phone,avatar_url,bio,created_at FROM users WHERE id=?").get(req.user.id));
});
app.put("/api/profile/password",auth,(req,res)=>{
 const {current_password,new_password}=req.body||{};
 if(!current_password||!new_password||new_password.length<8)return res.status(400).json({error:"Current password and a new 8+ character password are required"});
 const u=db.prepare("SELECT password_hash FROM users WHERE id=?").get(req.user.id);
 if(!u||!bcrypt.compareSync(current_password,u.password_hash))return res.status(401).json({error:"Current password is incorrect"});
 db.prepare("UPDATE users SET password_hash=? WHERE id=?").run(bcrypt.hashSync(new_password,12),req.user.id);
 res.json({ok:true});
});

app.get("/api/courses",auth,(req,res)=>{
 const rows=db.prepare("SELECT course,created_at FROM enrollments WHERE user_id=? ORDER BY created_at DESC").all(req.user.id);
 res.json(rows);
});

app.post("/api/courses/enroll",auth,(req,res)=>{
 const {course}=req.body||{};
 if(!course)return res.status(400).json({error:"Course is required"});
 db.prepare("INSERT OR IGNORE INTO enrollments(user_id,course) VALUES(?,?)").run(req.user.id,course);
 res.json({ok:true});
});

app.get("/api/videos",auth,(req,res)=>{
 const course=req.query.course;
 const rows=course?db.prepare("SELECT id,title,course,module,youtube_url,video_id,description FROM videos WHERE published=1 AND course=? ORDER BY id DESC").all(course)
 :db.prepare("SELECT id,title,course,module,youtube_url,video_id,description FROM videos WHERE published=1 ORDER BY id DESC").all();
 res.json(rows);
});

app.post("/api/videos",auth,admin,(req,res)=>{
 const {title,course,module,youtube_url,video_id,description=""}=req.body||{};
 if(!title||!course||!module||!youtube_url||!video_id)return res.status(400).json({error:"Missing video fields"});
 const info=db.prepare("INSERT INTO videos(title,course,module,youtube_url,video_id,description) VALUES(?,?,?,?,?,?)").run(title,course,module,youtube_url,video_id,description);
 res.status(201).json({id:info.lastInsertRowid});
});

app.get("/api/materials",auth,(req,res)=>{
 const course=req.query.course,type=req.query.type;
 let sql="SELECT id,title,course,type,url,description FROM materials WHERE published=1",p=[];
 if(course){sql+=" AND course=?";p.push(course)} if(type){sql+=" AND type=?";p.push(type)}
 res.json(db.prepare(sql+" ORDER BY id DESC").all(...p));
});

app.post("/api/materials",auth,admin,(req,res)=>{
 const {title,course,type,url,description=""}=req.body||{};
 if(!title||!course||!type||!url)return res.status(400).json({error:"Missing material fields"});
 const info=db.prepare("INSERT INTO materials(title,course,type,url,description) VALUES(?,?,?,?,?)").run(title,course,type,url,description);
 res.status(201).json({id:info.lastInsertRowid});
});

app.get("/api/tests",auth,(req,res)=>{
 res.json(db.prepare("SELECT id,title,course,instructions FROM tests WHERE published=1 ORDER BY id DESC").all());
});

app.get("/api/tests/:id",auth,(req,res)=>{
 const t=db.prepare("SELECT id,title,course,instructions FROM tests WHERE id=? AND published=1").get(req.params.id);
 if(!t)return res.status(404).json({error:"Test not found"});
 t.questions=db.prepare("SELECT id,question,option_a,option_b,option_c,option_d FROM questions WHERE test_id=?").all(t.id);
 res.json(t);
});

app.post("/api/tests/:id/submit",auth,(req,res)=>{
 const t=db.prepare("SELECT id FROM tests WHERE id=? AND published=1").get(req.params.id);
 if(!t)return res.status(404).json({error:"Test not found"});
 const answers=req.body?.answers||[];
 const qs=db.prepare("SELECT id,correct_index FROM questions WHERE test_id=? ORDER BY id").all(t.id);
 let correct=0; qs.forEach((q,i)=>{if(Number(answers[i])===q.correct_index)correct++});
 const score=Math.round(correct/(qs.length||1)*100);
 db.prepare("INSERT INTO test_results(user_id,test_id,score,correct,total) VALUES(?,?,?,?,?)").run(req.user.id,t.id,score,correct,qs.length);
 res.json({score,correct,total:qs.length});
});

app.post("/api/progress",auth,(req,res)=>{
 const {course,module_index,completed}=req.body||{};
 if(!course||module_index===undefined)return res.status(400).json({error:"Course and module_index are required"});
 db.prepare(`INSERT INTO lesson_progress(user_id,course,module_index,completed) VALUES(?,?,?,?)
 ON CONFLICT(user_id,course,module_index) DO UPDATE SET completed=excluded.completed,updated_at=CURRENT_TIMESTAMP`)
 .run(req.user.id,course,Number(module_index),completed?1:0);
 res.json({ok:true});
});

app.get("/api/dashboard",auth,(req,res)=>{
 const user=db.prepare("SELECT id,name,email,role FROM users WHERE id=?").get(req.user.id);
 const courses=db.prepare("SELECT course FROM enrollments WHERE user_id=? ORDER BY id").all(req.user.id).map(x=>x.course);
 const completed=db.prepare("SELECT course,module_index FROM lesson_progress WHERE user_id=? AND completed=1").all(req.user.id);
 const latest=db.prepare(`SELECT r.score,r.correct,r.total,r.created_at,t.title FROM test_results r JOIN tests t ON t.id=r.test_id WHERE r.user_id=? ORDER BY r.id DESC LIMIT 1`).get(req.user.id)||null;
 res.json({user,courses,completed,latestTest:latest});
});

app.get("/api/admin/students",auth,admin,(req,res)=>{
 const users=db.prepare("SELECT id,name,email,role,created_at FROM users WHERE role='student' ORDER BY id DESC").all();
 const out=users.map(u=>{
  const courses=db.prepare("SELECT course FROM enrollments WHERE user_id=?").all(u.id).map(x=>x.course);
  const done=db.prepare("SELECT COUNT(*) n FROM lesson_progress WHERE user_id=? AND completed=1").get(u.id).n;
  const latest=db.prepare(`SELECT score,created_at FROM test_results WHERE user_id=? ORDER BY id DESC LIMIT 1`).get(u.id)||null;
  return {...u,courses,completedModules:done,latestTest:latest};
 });
 res.json(out);
});

function refreshUserPoints(userId){const lessons=db.prepare("SELECT COUNT(*) n FROM lesson_progress WHERE user_id=? AND completed=1").get(userId).n;const attendance=db.prepare("SELECT COUNT(*) n FROM attendance WHERE user_id=?").get(userId).n;const tests=db.prepare("SELECT COALESCE(SUM(score),0) n FROM test_results WHERE user_id=?").get(userId).n;const xp=lessons*10+attendance*20+tests;db.prepare("INSERT INTO user_points(user_id,xp) VALUES(?,?) ON CONFLICT(user_id) DO UPDATE SET xp=excluded.xp,updated_at=CURRENT_TIMESTAMP").run(userId,xp);return xp;}
app.get("/api/leaderboard",auth,(req,res)=>{const users=db.prepare("SELECT id FROM users WHERE role='student'").all();users.forEach(u=>refreshUserPoints(u.id));const rows=db.prepare("SELECT u.id,u.name,p.xp FROM user_points p JOIN users u ON u.id=p.user_id WHERE u.role='student' ORDER BY p.xp DESC,u.name ASC LIMIT 100").all();res.json(rows.map((r,i)=>({...r,rank:i+1,badge:r.xp>=500?'Math Champion':r.xp>=250?'Math Pro':r.xp>=100?'Rising Star':'Math Explorer'})));});
app.get("/api/leaderboard/course",auth,(req,res)=>{const course=(req.query.course||'').trim();if(!course)return res.status(400).json({error:'Course is required'});const users=db.prepare("SELECT u.id,u.name FROM users u JOIN enrollments e ON e.user_id=u.id WHERE u.role='student' AND e.course=?").all(course);const out=users.map(u=>{const lessons=db.prepare("SELECT COUNT(*) n FROM lesson_progress WHERE user_id=? AND course=? AND completed=1").get(u.id,course).n;const tests=db.prepare("SELECT COALESCE(SUM(r.score),0) n FROM test_results r JOIN tests t ON t.id=r.test_id WHERE r.user_id=? AND t.course=?").get(u.id,course).n;const att=db.prepare("SELECT COUNT(*) n FROM attendance a JOIN live_classes c ON c.id=a.live_class_id WHERE a.user_id=? AND c.course=?").get(u.id,course).n;return {id:u.id,name:u.name,xp:lessons*10+tests+att*20};}).sort((a,b)=>b.xp-a.xp).slice(0,100);res.json(out.map((r,i)=>({...r,rank:i+1})));});
app.get("/api/points/me",auth,(req,res)=>res.json({xp:refreshUserPoints(req.user.id)}));

app.get("/api/live-classes",auth,(req,res)=>{
 const rows=(req.user.role==="admin"||req.user.role==="teacher")
  ?db.prepare(`SELECT c.*,u.name AS teacher_name FROM live_classes c JOIN users u ON u.id=c.teacher_id ORDER BY c.scheduled_at ASC`).all()
  :db.prepare(`SELECT c.*,u.name AS teacher_name FROM live_classes c JOIN users u ON u.id=c.teacher_id JOIN enrollments e ON e.course=c.course AND e.user_id=? WHERE c.status!='cancelled' ORDER BY c.scheduled_at ASC`).all(req.user.id);
 res.json(rows);
});
app.post("/api/live-classes",auth,(req,res)=>{
 if(!["admin","teacher"].includes(req.user.role))return res.status(403).json({error:"Teacher/Admin access required"});
 const {title,course,scheduled_at,duration_minutes=60,meeting_url,description=""}=req.body||{};
 if(!title||!course||!scheduled_at||!meeting_url)return res.status(400).json({error:"Title, course, scheduled time and meeting URL are required"});
 const info=db.prepare(`INSERT INTO live_classes(teacher_id,title,course,scheduled_at,duration_minutes,meeting_url,description) VALUES(?,?,?,?,?,?,?)`).run(req.user.id,title,course,scheduled_at,Number(duration_minutes)||60,meeting_url,description);
 res.status(201).json(db.prepare(`SELECT * FROM live_classes WHERE id=?`).get(info.lastInsertRowid));
});
app.delete("/api/live-classes/:id",auth,(req,res)=>{
 const row=db.prepare(`SELECT * FROM live_classes WHERE id=?`).get(req.params.id);
 if(!row)return res.status(404).json({error:"Live class not found"});
 if(req.user.role!=="admin"&&!(req.user.role==="teacher"&&row.teacher_id===req.user.id))return res.status(403).json({error:"Access denied"});
 db.prepare(`DELETE FROM live_classes WHERE id=?`).run(req.params.id); res.json({ok:true});
});
app.post("/api/live-classes/:id/attendance",auth,(req,res)=>{const c=db.prepare("SELECT * FROM live_classes WHERE id=?").get(req.params.id);if(!c)return res.status(404).json({error:"Live class not found"});if(req.user.role==="student"&&!db.prepare("SELECT 1 FROM enrollments WHERE user_id=? AND course=?").get(req.user.id,c.course))return res.status(403).json({error:"Enroll in this course first"});db.prepare("INSERT OR IGNORE INTO attendance(live_class_id,user_id) VALUES(?,?)").run(c.id,req.user.id);res.json({ok:true});});
app.get("/api/analytics/student",auth,(req,res)=>{if(req.user.role!=="student")return res.status(403).json({error:"Student access required"});const courses=db.prepare("SELECT course FROM enrollments WHERE user_id=?").all(req.user.id);const expected=courses.length*4,completed=db.prepare("SELECT COUNT(*) n FROM lesson_progress WHERE user_id=? AND completed=1").get(req.user.id).n,attended=db.prepare("SELECT COUNT(*) n FROM attendance WHERE user_id=?").get(req.user.id).n,tests=db.prepare("SELECT COUNT(*) n,COALESCE(AVG(score),0) avg_score FROM test_results WHERE user_id=?").get(req.user.id);res.json({courses:courses.map(x=>x.course),completed_modules:completed,expected_modules:expected,overall_progress:expected?Math.round(completed/expected*100):0,classes_attended:attended,tests_taken:tests.n,average_test_score:Math.round(tests.avg_score||0)});});
app.get("/api/analytics/admin",auth,(req,res)=>{if(!["admin","teacher"].includes(req.user.role))return res.status(403).json({error:"Teacher/Admin access required"});const students=db.prepare("SELECT COUNT(*) n FROM users WHERE role='student'").get().n,enrollments=db.prepare("SELECT COUNT(*) n FROM enrollments").get().n,classes_attended=db.prepare("SELECT COUNT(*) n FROM attendance").get().n,lessons_completed=db.prepare("SELECT COUNT(*) n FROM lesson_progress WHERE completed=1").get().n,tests=db.prepare("SELECT COUNT(*) n,COALESCE(AVG(score),0) avg_score FROM test_results").get();res.json({students,enrollments,classes_attended,lessons_completed,tests_taken:tests.n,average_test_score:Math.round(tests.avg_score||0)});});app.get("/api/announcements",auth,(req,res)=>{
 let rows;
 if(req.user.role==="admin"||req.user.role==="teacher") rows=db.prepare("SELECT a.*,u.name AS author_name FROM announcements a JOIN users u ON u.id=a.author_id ORDER BY a.id DESC").all();
 else rows=db.prepare("SELECT DISTINCT a.*,u.name AS author_name FROM announcements a JOIN users u ON u.id=a.author_id LEFT JOIN enrollments e ON e.course=a.course AND e.user_id=? WHERE a.course IS NULL OR e.user_id IS NOT NULL ORDER BY a.id DESC").all(req.user.id);
 res.json(rows);
});
app.post("/api/announcements",auth,(req,res)=>{
 if(!["admin","teacher"].includes(req.user.role))return res.status(403).json({error:"Teacher/Admin access required"});
 const {title,message,course}=req.body||{}; if(!title||!message)return res.status(400).json({error:"Title and message are required"});
 const info=db.prepare("INSERT INTO announcements(author_id,title,message,course) VALUES(?,?,?,?)").run(req.user.id,title,message,course||null);
 res.status(201).json(db.prepare("SELECT * FROM announcements WHERE id=?").get(info.lastInsertRowid));
});
app.delete("/api/announcements/:id",auth,(req,res)=>{
 const row=db.prepare("SELECT * FROM announcements WHERE id=?").get(req.params.id); if(!row)return res.status(404).json({error:"Announcement not found"});
 if(req.user.role!=="admin"&&!(req.user.role==="teacher"&&row.author_id===req.user.id))return res.status(403).json({error:"Access denied"});
 db.prepare("DELETE FROM announcements WHERE id=?").run(req.params.id); res.json({ok:true});
});

app.listen(PORT,()=>console.log(`Settlem Academy API running on http://localhost:${PORT}`));
