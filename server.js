require("dotenv").config();
const express=require("express");
const cors=require("cors");
const bcrypt=require("bcryptjs");
const jwt=require("jsonwebtoken");
const {Pool}=require("pg");

const app=express();
const PORT=process.env.PORT||4000;
const JWT_SECRET=process.env.JWT_SECRET||"CHANGE_THIS_SECRET";
if(!process.env.DATABASE_URL) console.warn("DATABASE_URL is not set");
const pool=new Pool({
  connectionString:process.env.DATABASE_URL,
  ssl:process.env.DATABASE_URL?{rejectUnauthorized:false}:false,
  max:5,
  idleTimeoutMillis:30000
});

app.use(cors({origin:process.env.FRONTEND_ORIGIN||true}));
app.use(express.json());

async function query(text,params=[]){return pool.query(text,params)}
async function initDb(){
 await query(`
 CREATE TABLE IF NOT EXISTS users(
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'student',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
 );
 CREATE TABLE IF NOT EXISTS enrollments(
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id,course)
 );
 CREATE TABLE IF NOT EXISTS videos(
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  course TEXT NOT NULL,
  module TEXT NOT NULL,
  youtube_url TEXT NOT NULL,
  video_id TEXT NOT NULL,
  description TEXT DEFAULT '',
  published INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
 );
 CREATE TABLE IF NOT EXISTS materials(
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  course TEXT NOT NULL,
  type TEXT NOT NULL,
  url TEXT NOT NULL,
  description TEXT DEFAULT '',
  published INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
 );
 CREATE TABLE IF NOT EXISTS tests(
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  course TEXT NOT NULL,
  instructions TEXT DEFAULT '',
  published INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
 );
 CREATE TABLE IF NOT EXISTS questions(
  id SERIAL PRIMARY KEY,
  test_id INTEGER NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  option_a TEXT NOT NULL,
  option_b TEXT NOT NULL,
  option_c TEXT NOT NULL,
  option_d TEXT NOT NULL,
  correct_index INTEGER NOT NULL
 );
 CREATE TABLE IF NOT EXISTS lesson_progress(
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course TEXT NOT NULL,
  module_index INTEGER NOT NULL,
  completed INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id,course,module_index)
 );
 CREATE TABLE IF NOT EXISTS test_results(
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  test_id INTEGER NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
  score INTEGER NOT NULL,
  correct INTEGER NOT NULL,
  total INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
 );`);
}

function tokenFor(user){return jwt.sign({id:user.id,role:user.role},JWT_SECRET,{expiresIn:"7d"})}
function auth(req,res,next){
 const h=req.headers.authorization||"";
 if(!h.startsWith("Bearer "))return res.status(401).json({error:"Authentication required"});
 try{req.user=jwt.verify(h.slice(7),JWT_SECRET);next()}catch(e){return res.status(401).json({error:"Invalid or expired token"})}
}
function admin(req,res,next){if(req.user.role!=="admin")return res.status(403).json({error:"Admin access required"});next()}

app.get("/api/health",async(req,res)=>{
 try{await query("SELECT 1");res.json({ok:true,service:"Settlem Academy API",database:"postgres"})}
 catch(e){res.status(503).json({ok:false,error:"Database unavailable"})}
});

app.post("/api/auth/register",async(req,res)=>{
 const {name,email,password}=req.body||{};
 if(!name||!email||!password||password.length<6)return res.status(400).json({error:"Name, email and a 6+ character password are required"});
 try{
  const hash=bcrypt.hashSync(password,12);
  const r=await query("INSERT INTO users(name,email,password_hash) VALUES($1,$2,$3) RETURNING id,name,email,role",[name.trim(),email.trim().toLowerCase(),hash]);
  const user=r.rows[0];
  res.status(201).json({token:tokenFor(user),user});
 }catch(e){res.status(409).json({error:"An account with this email already exists"})}
});

app.post("/api/auth/login",async(req,res)=>{
 try{
  const {email,password}=req.body||{};
  const r=await query("SELECT * FROM users WHERE email=$1",[(email||"").trim().toLowerCase()]);
  const u=r.rows[0];
  if(!u||!bcrypt.compareSync(password||"",u.password_hash))return res.status(401).json({error:"Invalid email or password"});
  const user={id:u.id,name:u.name,email:u.email,role:u.role};
  res.json({token:tokenFor(user),user});
 }catch(e){res.status(500).json({error:"Login failed"})}
});

app.get("/api/me",auth,async(req,res)=>{
 const r=await query("SELECT id,name,email,role,created_at FROM users WHERE id=$1",[req.user.id]);res.json(r.rows[0]||{});
});
app.get("/api/courses",auth,async(req,res)=>{
 const r=await query("SELECT course,created_at FROM enrollments WHERE user_id=$1 ORDER BY created_at DESC",[req.user.id]);res.json(r.rows);
});
app.post("/api/courses/enroll",auth,async(req,res)=>{
 const {course}=req.body||{};if(!course)return res.status(400).json({error:"Course is required"});
 await query("INSERT INTO enrollments(user_id,course) VALUES($1,$2) ON CONFLICT(user_id,course) DO NOTHING",[req.user.id,course]);res.json({ok:true});
});

app.get("/api/videos",auth,async(req,res)=>{
 const course=req.query.course;
 const r=course?await query("SELECT id,title,course,module,youtube_url,video_id,description FROM videos WHERE published=1 AND course=$1 ORDER BY id DESC",[course]):await query("SELECT id,title,course,module,youtube_url,video_id,description FROM videos WHERE published=1 ORDER BY id DESC");
 res.json(r.rows);
});
app.post("/api/videos",auth,admin,async(req,res)=>{
 const {title,course,module,youtube_url,video_id,description=""}=req.body||{};
 if(!title||!course||!module||!youtube_url||!video_id)return res.status(400).json({error:"Missing video fields"});
 const r=await query("INSERT INTO videos(title,course,module,youtube_url,video_id,description) VALUES($1,$2,$3,$4,$5,$6) RETURNING id",[title,course,module,youtube_url,video_id,description]);res.status(201).json({id:r.rows[0].id});
});

app.get("/api/materials",auth,async(req,res)=>{
 const {course,type}=req.query;let sql="SELECT id,title,course,type,url,description FROM materials WHERE published=1",p=[];
 if(course){sql+=" AND course=$"+(p.length+1);p.push(course)} if(type){sql+=" AND type=$"+(p.length+1);p.push(type)}
 const r=await query(sql+" ORDER BY id DESC",p);res.json(r.rows);
});
app.post("/api/materials",auth,admin,async(req,res)=>{
 const {title,course,type,url,description=""}=req.body||{};
 if(!title||!course||!type||!url)return res.status(400).json({error:"Missing material fields"});
 const r=await query("INSERT INTO materials(title,course,type,url,description) VALUES($1,$2,$3,$4,$5) RETURNING id",[title,course,type,url,description]);res.status(201).json({id:r.rows[0].id});
});

app.get("/api/tests",auth,async(req,res)=>{const r=await query("SELECT id,title,course,instructions FROM tests WHERE published=1 ORDER BY id DESC");res.json(r.rows)});
app.get("/api/tests/:id",auth,async(req,res)=>{
 const r=await query("SELECT id,title,course,instructions FROM tests WHERE id=$1 AND published=1",[req.params.id]);const t=r.rows[0];if(!t)return res.status(404).json({error:"Test not found"});
 const q=await query("SELECT id,question,option_a,option_b,option_c,option_d FROM questions WHERE test_id=$1",[t.id]);t.questions=q.rows;res.json(t);
});
app.post("/api/tests/:id/submit",auth,async(req,res)=>{
 const t=await query("SELECT id FROM tests WHERE id=$1 AND published=1",[req.params.id]);if(!t.rows[0])return res.status(404).json({error:"Test not found"});
 const answers=req.body?.answers||[];const qr=await query("SELECT id,correct_index FROM questions WHERE test_id=$1 ORDER BY id",[t.rows[0].id]);
 let correct=0;qr.rows.forEach((q,i)=>{if(Number(answers[i])===q.correct_index)correct++});
 const total=qr.rows.length,score=Math.round(correct/(total||1)*100);
 await query("INSERT INTO test_results(user_id,test_id,score,correct,total) VALUES($1,$2,$3,$4,$5)",[req.user.id,t.rows[0].id,score,correct,total]);res.json({score,correct,total});
});

app.post("/api/progress",auth,async(req,res)=>{
 const {course,module_index,completed}=req.body||{};if(!course||module_index===undefined)return res.status(400).json({error:"Course and module_index are required"});
 await query(`INSERT INTO lesson_progress(user_id,course,module_index,completed) VALUES($1,$2,$3,$4)
 ON CONFLICT(user_id,course,module_index) DO UPDATE SET completed=EXCLUDED.completed,updated_at=NOW()`,[req.user.id,course,Number(module_index),completed?1:0]);res.json({ok:true});
});

app.get("/api/dashboard",auth,async(req,res)=>{
 const user=(await query("SELECT id,name,email,role FROM users WHERE id=$1",[req.user.id])).rows[0];
 const courses=(await query("SELECT course FROM enrollments WHERE user_id=$1 ORDER BY id",[req.user.id])).rows.map(x=>x.course);
 const completed=(await query("SELECT course,module_index FROM lesson_progress WHERE user_id=$1 AND completed=1",[req.user.id])).rows;
 const latest=(await query(`SELECT r.score,r.correct,r.total,r.created_at,t.title FROM test_results r JOIN tests t ON t.id=r.test_id WHERE r.user_id=$1 ORDER BY r.id DESC LIMIT 1`,[req.user.id])).rows[0]||null;
 res.json({user,courses,completed,latestTest:latest});
});

app.post("/api/admin/bootstrap",async(req,res)=>{
 const secret=process.env.ADMIN_BOOTSTRAP_SECRET;
 if(!secret||req.headers["x-bootstrap-secret"]!==secret)return res.status(403).json({error:"Bootstrap not authorized"});
 const {name,email,password}=req.body||{};
 if(!name||!email||!password||password.length<8)return res.status(400).json({error:"Name, email and an 8+ character password are required"});
 const hash=bcrypt.hashSync(password,12);
 try{
  const existing=await query("SELECT id FROM users WHERE role='admin' LIMIT 1");
  if(existing.rows.length)return res.status(409).json({error:"An admin account already exists"});
  const r=await query("INSERT INTO users(name,email,password_hash,role) VALUES($1,$2,$3,'admin') RETURNING id,name,email,role",[name.trim(),email.trim().toLowerCase(),hash]);
  res.status(201).json({ok:true,user:r.rows[0]});
 }catch(e){res.status(409).json({error:"An account with this email already exists"})}
});

app.get("/api/admin/students",auth,admin,async(req,res)=>{
 const users=(await query("SELECT id,name,email,role,created_at FROM users WHERE role='student' ORDER BY id DESC")).rows;
 const out=[];
 for(const u of users){
  const courses=(await query("SELECT course FROM enrollments WHERE user_id=$1",[u.id])).rows.map(x=>x.course);
  const done=(await query("SELECT COUNT(*)::int AS n FROM lesson_progress WHERE user_id=$1 AND completed=1",[u.id])).rows[0].n;
  const latest=(await query("SELECT score,created_at FROM test_results WHERE user_id=$1 ORDER BY id DESC LIMIT 1",[u.id])).rows[0]||null;
  out.push({...u,courses,completedModules:done,latestTest:latest});
 }
 res.json(out);
});

initDb().then(()=>app.listen(PORT,()=>console.log(`Settlem Academy API running on port ${PORT}`))).catch(err=>{console.error("Database initialization failed",err);process.exit(1)});
process.on("SIGTERM",async()=>{await pool.end();process.exit(0)});
