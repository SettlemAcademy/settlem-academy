require("dotenv").config();
const express=require("express");
const cors=require("cors");
const bcrypt=require("bcryptjs");
const jwt=require("jsonwebtoken");
const Database=require("better-sqlite3");

const app=express();
const db=new Database(process.env.DB_PATH||"settlem-academy.db");
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
`);

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

app.listen(PORT,()=>console.log(`Settlem Academy API running on http://localhost:${PORT}`));
