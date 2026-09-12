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
app.use(express.json({limit:"1mb"}));

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
 module TEXT DEFAULT '',
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
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 title TEXT NOT NULL,
 course TEXT NOT NULL,
 scheduled_at TEXT NOT NULL,
 duration_minutes INTEGER NOT NULL DEFAULT 60,
 meeting_url TEXT NOT NULL,
 teacher_id INTEGER,
 status TEXT NOT NULL DEFAULT 'scheduled',
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS attendance(
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 live_class_id INTEGER NOT NULL REFERENCES live_classes(id) ON DELETE CASCADE,
 user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 joined_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(live_class_id,user_id)
);
CREATE TABLE IF NOT EXISTS user_points(
 user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
 points INTEGER NOT NULL DEFAULT 0,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS announcements(
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 title TEXT NOT NULL,
 message TEXT NOT NULL,
 course TEXT,
 author_id INTEGER REFERENCES users(id),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
`);

// Backward-compatible schema upgrades for databases created by earlier versions.
const materialCols=db.prepare("PRAGMA table_info(materials)").all().map(x=>x.name);
if(!materialCols.includes("module")) db.exec("ALTER TABLE materials ADD COLUMN module TEXT DEFAULT ''");
const testCols=db.prepare("PRAGMA table_info(tests)").all().map(x=>x.name);
if(!testCols.includes("module")) db.exec("ALTER TABLE tests ADD COLUMN module TEXT DEFAULT ''");
const userCols=db.prepare("PRAGMA table_info(users)").all().map(x=>x.name);
if(!userCols.includes("phone")) db.exec("ALTER TABLE users ADD COLUMN phone TEXT DEFAULT ''");
if(!userCols.includes("avatar_url")) db.exec("ALTER TABLE users ADD COLUMN avatar_url TEXT DEFAULT ''");
if(!userCols.includes("bio")) db.exec("ALTER TABLE users ADD COLUMN bio TEXT DEFAULT ''");

// Optional production admin bootstrap. When ADMIN_NAME, ADMIN_EMAIL and
// ADMIN_PASSWORD are configured in Render, ensure that account exists and
// has admin access. This is especially useful when SQLite is recreated on a
// new Render instance. If the variables are not configured, no admin is
// created automatically.
function ensureConfiguredAdmin(){
 const name=(process.env.ADMIN_NAME||"").trim();
 const email=(process.env.ADMIN_EMAIL||"").trim().toLowerCase();
 const password=process.env.ADMIN_PASSWORD||"";
 if(!name || !email || !password) return;
 if(password.length<8){
  console.warn("ADMIN_PASSWORD is configured but is shorter than 8 characters; admin bootstrap skipped.");
  return;
 }
 const hash=bcrypt.hashSync(password,12);
 const existing=db.prepare("SELECT id FROM users WHERE email=?").get(email);
 if(existing){
  db.prepare("UPDATE users SET name=?,password_hash=?,role='admin' WHERE id=?").run(name,hash,existing.id);
  console.log("Configured admin account ready:",email);
 }else{
  const result=db.prepare("INSERT INTO users (name,email,password_hash,role) VALUES (?,?,?,'admin')").run(name,email,hash);
  console.log("Configured admin account created:",email,"id:",result.lastInsertRowid);
 }
}
ensureConfiguredAdmin();

function tokenFor(user){return jwt.sign({id:user.id,role:user.role},JWT_SECRET,{expiresIn:"7d"})}
function auth(req,res,next){
 const h=req.headers.authorization||"";
 if(!h.startsWith("Bearer ")) return res.status(401).json({error:"Authentication required"});
 try{
  const payload=jwt.verify(h.slice(7),JWT_SECRET);
  const u=db.prepare("SELECT id,name,email,role FROM users WHERE id=?").get(payload.id);
  if(!u) return res.status(401).json({error:"Session expired. Please sign in again."});
  req.user=u;
  next();
 }catch(e){return res.status(401).json({error:"Invalid or expired token. Please sign in again."})}
}
function admin(req,res,next){if(req.user.role!=="admin")return res.status(403).json({error:"Admin access required"});next()}
function safeVideoId(value=""){
 const s=String(value).trim();
 const m=s.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([A-Za-z0-9_-]{6,})/);
 return m?m[1]:s;
}

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

app.get("/api/me",auth,(req,res)=>res.json(req.user));

app.get("/api/profile",auth,(req,res)=>{
 const u=db.prepare("SELECT id,name,email,role,phone,avatar_url,bio,created_at FROM users WHERE id=?").get(req.user.id);res.json(u||{});
});
app.put("/api/profile",auth,(req,res)=>{
 const {name,phone,avatar_url,bio}=req.body||{};
 db.prepare("UPDATE users SET name=COALESCE(?,name),phone=COALESCE(?,phone),avatar_url=COALESCE(?,avatar_url),bio=COALESCE(?,bio) WHERE id=?").run(name?.trim()||null,phone??null,avatar_url??null,bio??null,req.user.id);
 res.json(db.prepare("SELECT id,name,email,role,phone,avatar_url,bio,created_at FROM users WHERE id=?").get(req.user.id));
});
app.put("/api/profile/password",auth,(req,res)=>{
 const {currentPassword,newPassword}=req.body||{};
 const u=db.prepare("SELECT password_hash FROM users WHERE id=?").get(req.user.id);
 if(!u||!bcrypt.compareSync(currentPassword||"",u.password_hash))return res.status(400).json({error:"Current password is incorrect"});
 if(!newPassword||newPassword.length<6)return res.status(400).json({error:"New password must be at least 6 characters"});
 db.prepare("UPDATE users SET password_hash=? WHERE id=?").run(bcrypt.hashSync(newPassword,12),req.user.id);res.json({ok:true});
});

app.get("/api/courses",auth,(req,res)=>res.json(db.prepare("SELECT course,created_at FROM enrollments WHERE user_id=? ORDER BY created_at DESC").all(req.user.id)));
app.post("/api/courses/enroll",auth,(req,res)=>{
 const {course}=req.body||{};
 if(!course)return res.status(400).json({error:"Course is required"});
 try{db.prepare("INSERT OR IGNORE INTO enrollments(user_id,course) VALUES(?,?)").run(req.user.id,course);res.json({ok:true,course})}
 catch(e){console.error(e);res.status(500).json({error:"Unable to save enrollment. Please try again."})}
});

// Student-facing published content.
app.get("/api/videos",auth,(req,res)=>{
 const course=req.query.course,module=req.query.module;
 let sql="SELECT id,title,course,module,youtube_url,video_id,description FROM videos WHERE published=1",p=[];
 if(course){sql+=" AND course=?";p.push(course)} if(module){sql+=" AND module=?";p.push(module)}
 res.json(db.prepare(sql+" ORDER BY id DESC").all(...p));
});
app.get("/api/materials",auth,(req,res)=>{
 const course=req.query.course,module=req.query.module,type=req.query.type;
 let sql="SELECT id,title,course,module,type,url,description FROM materials WHERE published=1",p=[];
 if(course){sql+=" AND course=?";p.push(course)} if(module){sql+=" AND module=?";p.push(module)} if(type){sql+=" AND type=?";p.push(type)}
 res.json(db.prepare(sql+" ORDER BY id DESC").all(...p));
});
app.get("/api/tests",auth,(req,res)=>{
 const course=req.query.course,module=req.query.module;
 let sql="SELECT id,title,course,module,instructions FROM tests WHERE published=1",p=[];
 if(course){sql+=" AND course=?";p.push(course)} if(module){sql+=" AND module=?";p.push(module)}
 res.json(db.prepare(sql+" ORDER BY id DESC").all(...p));
});
app.get("/api/tests/:id",auth,(req,res)=>{
 const t=db.prepare("SELECT id,title,course,module,instructions FROM tests WHERE id=? AND published=1").get(req.params.id);
 if(!t)return res.status(404).json({error:"Test not found"});
 t.questions=db.prepare("SELECT id,question,option_a,option_b,option_c,option_d FROM questions WHERE test_id=? ORDER BY id").all(t.id);res.json(t);
});
app.post("/api/tests/:id/submit",auth,(req,res)=>{
 const t=db.prepare("SELECT id FROM tests WHERE id=? AND published=1").get(req.params.id);if(!t)return res.status(404).json({error:"Test not found"});
 const answers=Array.isArray(req.body?.answers)?req.body.answers:[];
 const qs=db.prepare("SELECT id,correct_index FROM questions WHERE test_id=? ORDER BY id").all(t.id);
 let correct=0;qs.forEach((q,i)=>{if(Number(answers[i])===q.correct_index)correct++});
 const score=Math.round(correct/(qs.length||1)*100);
 db.prepare("INSERT INTO test_results(user_id,test_id,score,correct,total) VALUES(?,?,?,?,?)").run(req.user.id,t.id,score,correct,qs.length);
 res.json({score,correct,total:qs.length});
});

// Admin content management.
app.get("/api/admin/content",auth,admin,(req,res)=>{
 const videos=db.prepare("SELECT id,'video' AS type,title,course,module,description,published,created_at,youtube_url AS url FROM videos ORDER BY id DESC").all();
 const materials=db.prepare("SELECT id,'material' AS type,title,course,module,description,published,created_at,url FROM materials ORDER BY id DESC").all();
 const tests=db.prepare("SELECT id,'test' AS type,title,course,module,instructions AS description,published,created_at,'' AS url FROM tests ORDER BY id DESC").all();
 res.json([...videos,...materials,...tests].sort((a,b)=>b.id-a.id));
});
app.post("/api/videos",auth,admin,(req,res)=>{
 const {title,course,module,youtube_url,video_id,description="",published=true}=req.body||{};
 const vid=safeVideoId(video_id||youtube_url);
 if(!title||!course||!module||!youtube_url||!vid)return res.status(400).json({error:"Title, course, module and YouTube URL are required"});
 const info=db.prepare("INSERT INTO videos(title,course,module,youtube_url,video_id,description,published) VALUES(?,?,?,?,?,?,?)").run(title.trim(),course,module,youtube_url.trim(),vid,description||"",published?1:0);
 res.status(201).json(db.prepare("SELECT * FROM videos WHERE id=?").get(info.lastInsertRowid));
});
app.put("/api/videos/:id",auth,admin,(req,res)=>{
 const v=db.prepare("SELECT * FROM videos WHERE id=?").get(req.params.id);if(!v)return res.status(404).json({error:"Video not found"});
 const b=req.body||{},vid=safeVideoId(b.video_id||b.youtube_url||v.video_id);
 db.prepare("UPDATE videos SET title=?,course=?,module=?,youtube_url=?,video_id=?,description=?,published=? WHERE id=?").run(b.title??v.title,b.course??v.course,b.module??v.module,b.youtube_url??v.youtube_url,vid,b.description??v.description,b.published===undefined?v.published:(b.published?1:0),v.id);
 res.json({ok:true});
});
app.delete("/api/videos/:id",auth,admin,(req,res)=>{db.prepare("DELETE FROM videos WHERE id=?").run(req.params.id);res.json({ok:true})});

app.post("/api/materials",auth,admin,(req,res)=>{
 const {title,course,module="",type="PDF",url,description="",published=true}=req.body||{};
 if(!title||!course||!url)return res.status(400).json({error:"Title, course and resource URL are required"});
 const info=db.prepare("INSERT INTO materials(title,course,module,type,url,description,published) VALUES(?,?,?,?,?,?,?)").run(title.trim(),course,module,type,url.trim(),description||"",published?1:0);
 res.status(201).json(db.prepare("SELECT * FROM materials WHERE id=?").get(info.lastInsertRowid));
});
app.put("/api/materials/:id",auth,admin,(req,res)=>{
 const m=db.prepare("SELECT * FROM materials WHERE id=?").get(req.params.id);if(!m)return res.status(404).json({error:"Material not found"});const b=req.body||{};
 db.prepare("UPDATE materials SET title=?,course=?,module=?,type=?,url=?,description=?,published=? WHERE id=?").run(b.title??m.title,b.course??m.course,b.module??m.module,b.type??m.type,b.url??m.url,b.description??m.description,b.published===undefined?m.published:(b.published?1:0),m.id);res.json({ok:true});
});
app.delete("/api/materials/:id",auth,admin,(req,res)=>{db.prepare("DELETE FROM materials WHERE id=?").run(req.params.id);res.json({ok:true})});

app.post("/api/tests",auth,admin,(req,res)=>{
 const {title,course,module="",instructions="",published=false}=req.body||{};
 if(!title||!course)return res.status(400).json({error:"Test title and course are required"});
 const info=db.prepare("INSERT INTO tests(title,course,module,instructions,published) VALUES(?,?,?,?,?)").run(title.trim(),course,module,instructions||"",published?1:0);
 res.status(201).json(db.prepare("SELECT * FROM tests WHERE id=?").get(info.lastInsertRowid));
});
app.post("/api/tests/:id/questions",auth,admin,(req,res)=>{
 const t=db.prepare("SELECT id FROM tests WHERE id=?").get(req.params.id);if(!t)return res.status(404).json({error:"Test not found"});
 const {question,option_a,option_b,option_c,option_d,correct_index}=req.body||{};
 if(!question||![option_a,option_b,option_c,option_d].every(Boolean)||![0,1,2,3].includes(Number(correct_index)))return res.status(400).json({error:"Complete question and four options, then choose the correct answer"});
 const info=db.prepare("INSERT INTO questions(test_id,question,option_a,option_b,option_c,option_d,correct_index) VALUES(?,?,?,?,?,?,?)").run(t.id,question,option_a,option_b,option_c,option_d,Number(correct_index));res.status(201).json({id:info.lastInsertRowid});
});
app.put("/api/tests/:id",auth,admin,(req,res)=>{
 const t=db.prepare("SELECT * FROM tests WHERE id=?").get(req.params.id);if(!t)return res.status(404).json({error:"Test not found"});const b=req.body||{};
 db.prepare("UPDATE tests SET title=?,course=?,module=?,instructions=?,published=? WHERE id=?").run(b.title??t.title,b.course??t.course,b.module??t.module,b.instructions??t.instructions,b.published===undefined?t.published:(b.published?1:0),t.id);res.json({ok:true});
});
app.delete("/api/tests/:id",auth,admin,(req,res)=>{db.prepare("DELETE FROM tests WHERE id=?").run(req.params.id);res.json({ok:true})});

app.post("/api/progress",auth,(req,res)=>{
 const {course,module_index,completed}=req.body||{};if(!course||module_index===undefined)return res.status(400).json({error:"Course and module_index are required"});
 db.prepare(`INSERT INTO lesson_progress(user_id,course,module_index,completed) VALUES(?,?,?,?) ON CONFLICT(user_id,course,module_index) DO UPDATE SET completed=excluded.completed,updated_at=CURRENT_TIMESTAMP`).run(req.user.id,course,Number(module_index),completed?1:0);res.json({ok:true});
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
 res.json(users.map(u=>{const courses=db.prepare("SELECT course FROM enrollments WHERE user_id=?").all(u.id).map(x=>x.course);const done=db.prepare("SELECT COUNT(*) n FROM lesson_progress WHERE user_id=? AND completed=1").get(u.id).n;const latest=db.prepare("SELECT score,created_at FROM test_results WHERE user_id=? ORDER BY id DESC LIMIT 1").get(u.id)||null;return {...u,courses,completedModules:done,latestTest:latest}}));
});

app.get("/api/live-classes",auth,(req,res)=>{
 const rows=db.prepare(`SELECT c.*,u.name AS teacher_name FROM live_classes c LEFT JOIN users u ON u.id=c.teacher_id WHERE c.status!='cancelled' ORDER BY c.scheduled_at ASC`).all();res.json(rows);
});
app.post("/api/live-classes",auth,(req,res)=>{
 if(!["admin","teacher"].includes(req.user.role))return res.status(403).json({error:"Teacher/Admin access required"});const {title,course,scheduled_at,meeting_url,duration_minutes=60,teacher_id=null}=req.body||{};
 if(!title||!course||!scheduled_at||!meeting_url)return res.status(400).json({error:"Title, course, scheduled time and meeting URL are required"});const info=db.prepare("INSERT INTO live_classes(title,course,scheduled_at,duration_minutes,meeting_url,teacher_id) VALUES(?,?,?,?,?,?)").run(title,course,scheduled_at,Number(duration_minutes)||60,meeting_url,teacher_id||req.user.id);res.status(201).json({id:info.lastInsertRowid});
});
app.delete("/api/live-classes/:id",auth,(req,res)=>{const c=db.prepare("SELECT * FROM live_classes WHERE id=?").get(req.params.id);if(!c)return res.status(404).json({error:"Live class not found"});if(req.user.role!=="admin"&&c.teacher_id!==req.user.id)return res.status(403).json({error:"Access denied"});db.prepare("UPDATE live_classes SET status='cancelled' WHERE id=?").run(c.id);res.json({ok:true});});
app.post("/api/live-classes/:id/attendance",auth,(req,res)=>{const c=db.prepare("SELECT id FROM live_classes WHERE id=?").get(req.params.id);if(!c)return res.status(404).json({error:"Live class not found"});db.prepare("INSERT OR IGNORE INTO attendance(live_class_id,user_id) VALUES(?,?)").run(c.id,req.user.id);res.json({ok:true});});

app.get("/api/analytics/student",auth,(req,res)=>{
 const tests=db.prepare("SELECT COUNT(*) n FROM test_results WHERE user_id=?").get(req.user.id).n;const avg=db.prepare("SELECT COALESCE(AVG(score),0) n FROM test_results WHERE user_id=?").get(req.user.id).n;const done=db.prepare("SELECT COUNT(*) n FROM lesson_progress WHERE user_id=? AND completed=1").get(req.user.id).n;res.json({testsTaken:tests,averageScore:Math.round(avg),completedModules:done});
});
app.get("/api/analytics/admin",auth,admin,(req,res)=>{const students=db.prepare("SELECT COUNT(*) n FROM users WHERE role='student'").get().n;const enrollments=db.prepare("SELECT COUNT(*) n FROM enrollments").get().n;const videos=db.prepare("SELECT COUNT(*) n FROM videos").get().n;const materials=db.prepare("SELECT COUNT(*) n FROM materials").get().n;const tests=db.prepare("SELECT COUNT(*) n FROM tests").get().n;res.json({students,enrollments,videos,materials,tests});});

app.get("/api/announcements",auth,(req,res)=>res.json(db.prepare("SELECT id,title,message,course,created_at FROM announcements ORDER BY id DESC LIMIT 50").all()));
app.post("/api/announcements",auth,admin,(req,res)=>{const {title,message,course=null}=req.body||{};if(!title||!message)return res.status(400).json({error:"Title and message are required"});const info=db.prepare("INSERT INTO announcements(title,message,course,author_id) VALUES(?,?,?,?)").run(title,message,course,req.user.id);res.status(201).json({id:info.lastInsertRowid});});
app.delete("/api/announcements/:id",auth,admin,(req,res)=>{db.prepare("DELETE FROM announcements WHERE id=?").run(req.params.id);res.json({ok:true});});

app.get("/api/leaderboard",auth,(req,res)=>{const rows=db.prepare(`SELECT u.id,u.name,COALESCE(up.points,0) points FROM users u LEFT JOIN user_points up ON up.user_id=u.id WHERE u.role='student' ORDER BY points DESC,u.name ASC LIMIT 100`).all();res.json(rows);});
app.get("/api/leaderboard/course",auth,(req,res)=>res.json(db.prepare(`SELECT u.id,u.name,COALESCE(up.points,0) points FROM users u LEFT JOIN user_points up ON up.user_id=u.id WHERE u.role='student' ORDER BY points DESC,u.name ASC LIMIT 100`).all()));
app.get("/api/points/me",auth,(req,res)=>res.json(db.prepare("SELECT COALESCE(points,0) points FROM user_points WHERE user_id=?").get(req.user.id)||{points:0}));

app.listen(PORT,()=>console.log(`Settlem Academy API running on http://localhost:${PORT}`));
