require("dotenv").config();
const express=require("express");
const cors=require("cors");
const bcrypt=require("bcryptjs");
const jwt=require("jsonwebtoken");
const {Pool}=require("pg");
const {randomUUID}=require("crypto");
const helmet=require("helmet");
const rateLimit=require("express-rate-limit");

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

app.use(helmet({contentSecurityPolicy:false}));
app.use(cors({origin:process.env.FRONTEND_ORIGIN||true}));
app.use(express.json({limit:"200kb"}));
const authLimiter=rateLimit({windowMs:15*60*1000,max:30,standardHeaders:true,legacyHeaders:false,message:{error:"Too many authentication attempts. Please try again later."}});
app.use("/api/auth/login",authLimiter);
app.use("/api/auth/register",authLimiter);

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
 CREATE TABLE IF NOT EXISTS courses(
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  description TEXT DEFAULT '',
  level TEXT DEFAULT '',
  published INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
 );
 CREATE TABLE IF NOT EXISTS course_modules(
  id SERIAL PRIMARY KEY,
  course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  module_index INTEGER NOT NULL,
  published INTEGER NOT NULL DEFAULT 1,
  UNIQUE(course_id,module_index),
  UNIQUE(course_id,title)
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
 CREATE TABLE IF NOT EXISTS announcements(
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  audience TEXT NOT NULL DEFAULT 'all',
  published INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
 );
 CREATE TABLE IF NOT EXISTS test_results(
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  test_id INTEGER NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
  score INTEGER NOT NULL,
  correct INTEGER NOT NULL,
  total INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
 );
 CREATE TABLE IF NOT EXISTS certificates(
  id SERIAL PRIMARY KEY,
  certificate_id TEXT NOT NULL UNIQUE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course TEXT NOT NULL,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id,course)
 );
 CREATE TABLE IF NOT EXISTS feedback(
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course TEXT NOT NULL,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
 );
 CREATE TABLE IF NOT EXISTS academy_settings(
  key TEXT PRIMARY KEY, value TEXT NOT NULL DEFAULT ''
 );
 CREATE TABLE IF NOT EXISTS contact_enquiries(
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT DEFAULT '',
  level TEXT DEFAULT '',
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new',
  admin_note TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
 );
 CREATE TABLE IF NOT EXISTS faq_items(
  id SERIAL PRIMARY KEY,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'General',
  sort_order INTEGER NOT NULL DEFAULT 0,
  published BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
 );
 CREATE TABLE IF NOT EXISTS support_requests(
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course TEXT DEFAULT '',
  category TEXT NOT NULL DEFAULT 'General',
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  admin_note TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
 );`);
}

async function seedFaqs(){
 const r=await query("SELECT COUNT(*)::int AS n FROM faq_items");
 if(Number(r.rows[0].n)>0)return;
 const items=[
  ['Who can learn at Settlem Academy?','We currently support B.Tech Mathematics, Intermediate Mathematics, Class 10 Mathematics and Classes 5–7.','Courses',1],
  ['How do I start a course?','Create or sign in to your student account, choose a course and use the learning room to access available lessons and materials.','Courses',2],
  ['Can I watch lessons on YouTube?','Yes. Selected Settlem Academy lessons are available through the Video Lessons section and YouTube.','Learning',3],
  ['Are practice tests saved?','When you use a secure student account, submitted test scores can be saved to your Student Dashboard.','Tests',4],
  ['How do I get course support?','Use the Student Help Center or Contact page to send a support request or enquiry.','Support',5]
 ];
 for(const x of items) await query("INSERT INTO faq_items(question,answer,category,sort_order,published) VALUES($1,$2,$3,$4,TRUE)",x);
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

app.get("/api/admin/courses",auth,admin,async(req,res)=>{
 const r=await query(`SELECT c.id,c.name,c.slug,c.description,c.level,c.published,c.created_at,c.updated_at,COUNT(m.id)::int AS module_count
 FROM courses c LEFT JOIN course_modules m ON m.course_id=c.id GROUP BY c.id ORDER BY c.id`);
 res.json(r.rows);
});
app.post("/api/admin/courses",auth,admin,async(req,res)=>{
 const {name,slug,description="",level="",published=1}=req.body||{};
 if(!name||!slug)return res.status(400).json({error:"Course name and slug are required"});
 try{const r=await query(`INSERT INTO courses(name,slug,description,level,published) VALUES($1,$2,$3,$4,$5) RETURNING *`,[name.trim(),slug.trim().toLowerCase(),description.trim(),level.trim(),published?1:0]);res.status(201).json(r.rows[0]);}
 catch(e){res.status(409).json({error:"A course with this name or slug already exists"})}
});
app.patch("/api/admin/courses/:id",auth,admin,async(req,res)=>{
 const {name,slug,description,level,published}=req.body||{};
 const r=await query(`UPDATE courses SET name=COALESCE($1,name),slug=COALESCE($2,slug),description=COALESCE($3,description),level=COALESCE($4,level),published=COALESCE($5,published),updated_at=NOW() WHERE id=$6 RETURNING *`,[name?.trim()||null,slug?.trim().toLowerCase()||null,description?.trim()??null,level?.trim()??null,published===undefined?null:(published?1:0),req.params.id]);
 if(!r.rows.length)return res.status(404).json({error:"Course not found"});res.json(r.rows[0]);
});
app.delete("/api/admin/courses/:id",auth,admin,async(req,res)=>{
 const r=await query("DELETE FROM courses WHERE id=$1 RETURNING id",[req.params.id]);if(!r.rows.length)return res.status(404).json({error:"Course not found"});res.json({ok:true});
});
app.get("/api/admin/courses/:id/modules",auth,admin,async(req,res)=>{const r=await query("SELECT * FROM course_modules WHERE course_id=$1 ORDER BY module_index",[req.params.id]);res.json(r.rows)});
app.post("/api/admin/courses/:id/modules",auth,admin,async(req,res)=>{const {title,description="",module_index,published=1}=req.body||{};if(!title||module_index===undefined)return res.status(400).json({error:"Module title and index are required"});try{const r=await query(`INSERT INTO course_modules(course_id,title,description,module_index,published) VALUES($1,$2,$3,$4,$5) RETURNING *`,[req.params.id,title.trim(),description.trim(),Number(module_index),published?1:0]);res.status(201).json(r.rows[0])}catch(e){res.status(409).json({error:"Module index or title already exists for this course"})}});
app.patch("/api/admin/modules/:id",auth,admin,async(req,res)=>{const {title,description,published,module_index}=req.body||{};const r=await query(`UPDATE course_modules SET title=COALESCE($1,title),description=COALESCE($2,description),published=COALESCE($3,published),module_index=COALESCE($4,module_index) WHERE id=$5 RETURNING *`,[title?.trim()||null,description?.trim()??null,published===undefined?null:(published?1:0),module_index===undefined?null:Number(module_index),req.params.id]);if(!r.rows.length)return res.status(404).json({error:"Module not found"});res.json(r.rows[0])});
app.delete("/api/admin/modules/:id",auth,admin,async(req,res)=>{const r=await query("DELETE FROM course_modules WHERE id=$1 RETURNING id",[req.params.id]);if(!r.rows.length)return res.status(404).json({error:"Module not found"});res.json({ok:true})});

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
app.get("/api/admin/tests",auth,admin,async(req,res)=>{
 const r=await query(`SELECT t.id,t.title,t.course,t.instructions,t.published,t.created_at,COUNT(q.id)::int AS question_count
 FROM tests t LEFT JOIN questions q ON q.test_id=t.id GROUP BY t.id ORDER BY t.id DESC`);
 res.json(r.rows);
});
app.post("/api/tests",auth,admin,async(req,res)=>{
 const {title,course,instructions=""}=req.body||{};
 if(!title||!course)return res.status(400).json({error:"Test title and course are required"});
 const r=await query(`INSERT INTO tests(title,course,instructions,published) VALUES($1,$2,$3,0) RETURNING id,title,course,instructions,published,created_at`,[title.trim(),course,instructions.trim()]);
 res.status(201).json(r.rows[0]);
});
app.post("/api/tests/:id/questions",auth,admin,async(req,res)=>{
 const {question,option_a,option_b,option_c,option_d,correct_index}=req.body||{};
 if(!question||![option_a,option_b,option_c,option_d].every(Boolean)||![0,1,2,3].includes(Number(correct_index))) return res.status(400).json({error:"Question, all four options and a valid correct answer are required"});
 const t=await query("SELECT id FROM tests WHERE id=$1",[req.params.id]); if(!t.rows[0])return res.status(404).json({error:"Test not found"});
 const r=await query(`INSERT INTO questions(test_id,question,option_a,option_b,option_c,option_d,correct_index) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id,question,option_a,option_b,option_c,option_d,correct_index`,[req.params.id,question.trim(),option_a.trim(),option_b.trim(),option_c.trim(),option_d.trim(),Number(correct_index)]);
 res.status(201).json(r.rows[0]);
});
app.patch("/api/tests/:id",auth,admin,async(req,res)=>{
 const {published}=req.body||{};
 if(typeof published!=="boolean")return res.status(400).json({error:"published must be true or false"});
 if(published){const q=await query("SELECT COUNT(*)::int AS n FROM questions WHERE test_id=$1",[req.params.id]);if(!q.rows[0]||q.rows[0].n<1)return res.status(400).json({error:"Add at least one question before publishing"});}
 const r=await query("UPDATE tests SET published=$1 WHERE id=$2 RETURNING id,title,course,instructions,published,created_at",[published?1:0,req.params.id]);
 if(!r.rows[0])return res.status(404).json({error:"Test not found"});res.json(r.rows[0]);
});
app.delete("/api/tests/:id",auth,admin,async(req,res)=>{
 const r=await query("DELETE FROM tests WHERE id=$1 RETURNING id",[req.params.id]); if(!r.rows[0])return res.status(404).json({error:"Test not found"});res.json({ok:true});
});
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

app.post("/api/contact",async(req,res)=>{
 const {name,email,phone,level,message}=req.body||{};
 if(!name||!email||!message)return res.status(400).json({error:"Name, email and message are required"});
 if(String(message).trim().length>3000)return res.status(400).json({error:"Message is too long"});
 try{
  const r=await query(`INSERT INTO contact_enquiries(name,email,phone,level,message) VALUES($1,$2,$3,$4,$5) RETURNING id,name,email,phone,level,message,status,created_at`,[String(name).trim().slice(0,120),String(email).trim().toLowerCase().slice(0,180),String(phone||'').trim().slice(0,40),String(level||'').trim().slice(0,80),String(message).trim()]);
  res.status(201).json(r.rows[0]);
 }catch(e){res.status(500).json({error:"Unable to save enquiry"})}
});
app.get("/api/admin/contact-enquiries",auth,admin,async(req,res)=>{
 const status=req.query.status; const params=[]; let where='';
 if(status && ['new','in_progress','resolved'].includes(status)){params.push(status);where='WHERE c.status=$1'}
 const r=await query(`SELECT c.id,c.name,c.email,c.phone,c.level,c.message,c.status,c.admin_note,c.created_at,c.updated_at FROM contact_enquiries c ${where} ORDER BY c.id DESC`,params);
 res.json(r.rows);
});
app.patch("/api/admin/contact-enquiries/:id",auth,admin,async(req,res)=>{
 const {status,admin_note}=req.body||{};
 if(status!==undefined && !['new','in_progress','resolved'].includes(status))return res.status(400).json({error:"Invalid status"});
 const r=await query(`UPDATE contact_enquiries SET status=COALESCE($1,status),admin_note=COALESCE($2,admin_note),updated_at=NOW() WHERE id=$3 RETURNING *`,[status??null,admin_note===undefined?null:String(admin_note).trim().slice(0,3000),req.params.id]);
 if(!r.rows[0])return res.status(404).json({error:"Enquiry not found"}); res.json(r.rows[0]);
});

app.get("/api/announcements",auth,async(req,res)=>{
 const course=(req.query.course||"").trim();
 const r=await query(`SELECT id,title,message,audience,created_at FROM announcements WHERE published=1 AND (audience='all' OR audience=$1) ORDER BY id DESC LIMIT 20`,[course]);
 res.json(r.rows);
});
app.get("/api/admin/announcements",auth,admin,async(req,res)=>{
 const r=await query(`SELECT id,title,message,audience,published,created_at FROM announcements ORDER BY id DESC`);
 res.json(r.rows);
});
app.post("/api/announcements",auth,admin,async(req,res)=>{
 const {title,message,audience='all'}=req.body||{};
 const allowed=['all','B.Tech Mathematics','Intermediate Mathematics','Class 10 Mathematics','Classes 5–7 Mathematics'];
 if(!title||!message||!allowed.includes(audience))return res.status(400).json({error:'Title, message and a valid audience are required'});
 const r=await query(`INSERT INTO announcements(title,message,audience,published) VALUES($1,$2,$3,1) RETURNING id,title,message,audience,published,created_at`,[title.trim(),message.trim(),audience]);
 res.status(201).json(r.rows[0]);
});
app.patch("/api/announcements/:id",auth,admin,async(req,res)=>{
 const {published}=req.body||{}; if(typeof published!=='boolean')return res.status(400).json({error:'published must be true or false'});
 const r=await query(`UPDATE announcements SET published=$1 WHERE id=$2 RETURNING id,title,message,audience,published,created_at`,[published?1:0,req.params.id]);
 if(!r.rows[0])return res.status(404).json({error:'Announcement not found'}); res.json(r.rows[0]);
});
app.delete("/api/announcements/:id",auth,admin,async(req,res)=>{
 const r=await query('DELETE FROM announcements WHERE id=$1 RETURNING id',[req.params.id]); if(!r.rows[0])return res.status(404).json({error:'Announcement not found'}); res.json({ok:true});
});

app.get("/api/certificates",auth,async(req,res)=>{
 const rows=(await query("SELECT certificate_id,course,issued_at FROM certificates WHERE user_id=$1 ORDER BY issued_at DESC",[req.user.id])).rows;
 res.json(rows);
});

app.post("/api/certificates/issue",auth,async(req,res)=>{
 const {course}=req.body||{};
 if(!course)return res.status(400).json({error:"Course is required"});
 const enrolled=await query("SELECT 1 FROM enrollments WHERE user_id=$1 AND course=$2 LIMIT 1",[req.user.id,course]);
 if(!enrolled.rows.length)return res.status(403).json({error:"You are not enrolled in this course"});
 const completed=(await query("SELECT COUNT(DISTINCT module_index)::int AS n FROM lesson_progress WHERE user_id=$1 AND course=$2 AND completed::text IN ('1','true')",[req.user.id,course])).rows[0].n;
 if(completed<4)return res.status(400).json({error:"Complete all 4 learning modules to earn this certificate",completedModules:completed});
 const existing=(await query("SELECT certificate_id,course,issued_at FROM certificates WHERE user_id=$1 AND course=$2 LIMIT 1",[req.user.id,course])).rows[0];
 if(existing)return res.json(existing);
 const certificate_id="SA-"+randomUUID().replace(/-/g,"").slice(0,12).toUpperCase();
 const row=(await query("INSERT INTO certificates(certificate_id,user_id,course) VALUES($1,$2,$3) RETURNING certificate_id,course,issued_at",[certificate_id,req.user.id,course])).rows[0];
 res.status(201).json(row);
});

app.get("/api/certificates/verify/:certificate_id",async(req,res)=>{
 const row=(await query(`SELECT c.certificate_id,c.course,c.issued_at,u.name FROM certificates c JOIN users u ON u.id=c.user_id WHERE c.certificate_id=$1 LIMIT 1`,[req.params.certificate_id])).rows[0];
 if(!row)return res.status(404).json({error:"Certificate not found"});
 res.json({valid:true,...row});
});

app.get("/api/feedback",auth,async(req,res)=>{
 const course=req.query.course;
 const r=course?await query("SELECT id,course,rating,message,created_at FROM feedback WHERE user_id=$1 AND course=$2 ORDER BY id DESC",[req.user.id,course]):await query("SELECT id,course,rating,message,created_at FROM feedback WHERE user_id=$1 ORDER BY id DESC",[req.user.id]);
 res.json(r.rows);
});
app.post("/api/feedback",auth,async(req,res)=>{
 const {course,rating,message}=req.body||{};
 const n=Number(rating);
 if(!course||!Number.isInteger(n)||n<1||n>5||!message||String(message).trim().length<3)return res.status(400).json({error:"Course, a 1–5 rating and feedback are required"});
 const enrolled=await query("SELECT 1 FROM enrollments WHERE user_id=$1 AND course=$2 LIMIT 1",[req.user.id,course]);
 if(!enrolled.rows.length)return res.status(403).json({error:"You can submit feedback only for an enrolled course"});
 const r=await query("INSERT INTO feedback(user_id,course,rating,message) VALUES($1,$2,$3,$4) RETURNING id,course,rating,message,created_at",[req.user.id,course,n,String(message).trim().slice(0,2000)]);
 res.status(201).json(r.rows[0]);
});
app.get("/api/admin/feedback",auth,admin,async(req,res)=>{
 const r=await query(`SELECT f.id,f.course,f.rating,f.message,f.created_at,u.id AS user_id,u.name,u.email FROM feedback f JOIN users u ON u.id=f.user_id ORDER BY f.id DESC`);
 res.json(r.rows);
});

app.get("/api/support",auth,async(req,res)=>{
 const r=await query(`SELECT id,course,category,subject,message,status,admin_note,created_at,updated_at FROM support_requests WHERE user_id=$1 ORDER BY id DESC LIMIT 50`,[req.user.id]);
 res.json(r.rows);
});
app.post("/api/support",auth,async(req,res)=>{
 const {course='',category='General',subject,message}=req.body||{};
 const allowed=['General','Course Content','Technical Issue','Test / Assessment','Certificate','Enrollment / Payment'];
 if(!allowed.includes(category)||!subject||String(subject).trim().length<3||!message||String(message).trim().length<5)return res.status(400).json({error:'Category, subject and message are required'});
 const r=await query(`INSERT INTO support_requests(user_id,course,category,subject,message) VALUES($1,$2,$3,$4,$5) RETURNING id,course,category,subject,message,status,admin_note,created_at,updated_at`,[req.user.id,String(course||'').trim().slice(0,120),category,String(subject).trim().slice(0,160),String(message).trim().slice(0,3000)]);
 res.status(201).json(r.rows[0]);
});
app.get("/api/admin/support",auth,admin,async(req,res)=>{
 const status=String(req.query.status||'').trim();
 const params=[]; let where='';
 if(['open','in_progress','resolved'].includes(status)){params.push(status);where='WHERE s.status=$1';}
 const r=await query(`SELECT s.id,s.course,s.category,s.subject,s.message,s.status,s.admin_note,s.created_at,s.updated_at,u.id AS user_id,u.name,u.email FROM support_requests s JOIN users u ON u.id=s.user_id ${where} ORDER BY s.id DESC`,params);
 res.json(r.rows);
});
app.patch("/api/admin/support/:id",auth,admin,async(req,res)=>{
 const {status,admin_note}=req.body||{};
 if(status!==undefined&&!['open','in_progress','resolved'].includes(status))return res.status(400).json({error:'Invalid support status'});
 if(admin_note!==undefined&&String(admin_note).length>3000)return res.status(400).json({error:'Admin note is too long'});
 const r=await query(`UPDATE support_requests SET status=COALESCE($1,status),admin_note=COALESCE($2,admin_note),updated_at=NOW() WHERE id=$3 RETURNING id,course,category,subject,message,status,admin_note,created_at,updated_at`,[status??null,admin_note===undefined?null:String(admin_note).trim().slice(0,3000),req.params.id]);
 if(!r.rows[0])return res.status(404).json({error:'Support request not found'}); res.json(r.rows[0]);
});

app.post("/api/progress",auth,async(req,res)=>{
 const {course,module_index,completed}=req.body||{};if(!course||module_index===undefined)return res.status(400).json({error:"Course and module_index are required"});
 const saved=await query(`INSERT INTO lesson_progress(user_id,course,module_index,completed) VALUES($1,$2,$3,$4)
 ON CONFLICT(user_id,course,module_index) DO UPDATE SET completed=EXCLUDED.completed,updated_at=NOW()
 RETURNING id,course,module_index,completed,updated_at`,[req.user.id,course,Number(module_index),completed?1:0]);
 res.json({ok:true,progress:saved.rows[0]||null});
});

app.get("/api/dashboard",auth,async(req,res)=>{
 const user=(await query("SELECT id,name,email,role FROM users WHERE id=$1",[req.user.id])).rows[0];
 const courses=(await query("SELECT course FROM enrollments WHERE user_id=$1 ORDER BY id",[req.user.id])).rows.map(x=>x.course);
 const completed=(await query("SELECT course,module_index FROM lesson_progress WHERE user_id=$1 AND completed::text IN ('1','true') ORDER BY course,module_index",[req.user.id])).rows;
 const latest=(await query(`SELECT r.score,r.correct,r.total,r.created_at,t.title FROM test_results r JOIN tests t ON t.id=r.test_id WHERE r.user_id=$1 ORDER BY r.id DESC LIMIT 1`,[req.user.id])).rows[0]||null;
 res.json({user,courses,completed,completedModules:completed.length,latestTest:latest});
});


// Compatibility APIs used by newer Student Dashboard builds. They are derived from
// the existing PostgreSQL data model, so older and newer frontends can coexist.
app.get("/api/live-classes",auth,async(req,res)=>{
  res.json([]);
});

app.get("/api/points/me",auth,async(req,res)=>{
  const completed=Number((await query("SELECT COUNT(*)::int AS n FROM lesson_progress WHERE user_id=$1 AND completed::text IN ('1','true')",[req.user.id])).rows[0]?.n||0);
  const tests=Number((await query("SELECT COUNT(*)::int AS n FROM test_results WHERE user_id=$1",[req.user.id])).rows[0]?.n||0);
  const perfect=Number((await query("SELECT COUNT(*)::int AS n FROM test_results WHERE user_id=$1 AND score=100",[req.user.id])).rows[0]?.n||0);
  const points=completed*25+tests*10+perfect*25;
  const level=Math.max(1,Math.floor(points/100)+1);
  res.json({points,xp:points,level,completedModules:completed,testsTaken:tests,perfectTests:perfect});
});

app.get("/api/leaderboard",auth,async(req,res)=>{
  const rows=await query(`
    SELECT u.id,u.name,
      (COUNT(DISTINCT CASE WHEN lp.completed::text IN ('1','true') THEN lp.id END)*25
       +COUNT(DISTINCT tr.id)*10
       +COUNT(DISTINCT CASE WHEN tr.score=100 THEN tr.id END)*25)::int AS points
    FROM users u
    LEFT JOIN lesson_progress lp ON lp.user_id=u.id
    LEFT JOIN test_results tr ON tr.user_id=u.id
    WHERE u.role='student'
    GROUP BY u.id,u.name
    ORDER BY points DESC,u.name ASC
    LIMIT 20`);
  res.json(rows.rows.map((r,i)=>({...r,rank:i+1,xp:Number(r.points||0)})));
});

app.get("/api/analytics/student",auth,async(req,res)=>{
  const courses=(await query("SELECT course,created_at FROM enrollments WHERE user_id=$1 ORDER BY created_at DESC",[req.user.id])).rows;
  const progress=(await query(`SELECT course,COUNT(*) FILTER (WHERE completed::text IN ('1','true'))::int AS completed_modules,COUNT(*)::int AS tracked_modules
    FROM lesson_progress WHERE user_id=$1 GROUP BY course ORDER BY course`,[req.user.id])).rows.map(r=>({...r,progress_percent:Math.min(100,Number(r.completed_modules||0)*25)}));
  const tests=(await query(`SELECT r.test_id,r.score,r.correct,r.total,r.created_at,t.title,t.course
    FROM test_results r JOIN tests t ON t.id=r.test_id WHERE r.user_id=$1 ORDER BY r.id DESC LIMIT 20`,[req.user.id])).rows;
  const avg=tests.length?Math.round(tests.reduce((a,b)=>a+Number(b.score||0),0)/tests.length):0;
  res.json({courses,progress,tests,summary:{enrolled_courses:courses.length,average_test_score:avg,total_tests:tests.length}});
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


app.get("/api/admin/users",auth,admin,async(req,res)=>{
 const r=await query("SELECT id,name,email,role,created_at FROM users ORDER BY CASE WHEN role='admin' THEN 0 ELSE 1 END, id DESC");
 res.json(r.rows);
});
app.patch("/api/admin/users/:id/role",auth,admin,async(req,res)=>{
 const id=Number(req.params.id), role=String(req.body.role||'').trim();
 if(!Number.isInteger(id)||!['admin','student'].includes(role)) return res.status(400).json({error:'Invalid user or role'});
 if(id===req.user.id && role==='student'){ const n=Number((await query("SELECT COUNT(*)::int AS n FROM users WHERE role='admin'")).rows[0].n); if(n<=1) return res.status(400).json({error:'You cannot remove the last administrator.'}); }
 const r=await query("UPDATE users SET role=$1 WHERE id=$2 RETURNING id,name,email,role,created_at",[role,id]);
 if(!r.rows[0]) return res.status(404).json({error:'User not found'}); res.json(r.rows[0]);
});
app.get("/api/faq",async(req,res)=>{ const r=await query("SELECT id,question,answer,category,sort_order FROM faq_items WHERE published=TRUE ORDER BY sort_order,id"); res.json(r.rows); });
app.get("/api/admin/faq",auth,admin,async(req,res)=>{ const r=await query("SELECT id,question,answer,category,sort_order,published,created_at,updated_at FROM faq_items ORDER BY sort_order,id"); res.json(r.rows); });
app.post("/api/admin/faq",auth,admin,async(req,res)=>{ const q=String(req.body.question||'').trim(), a=String(req.body.answer||'').trim(), c=String(req.body.category||'General').trim().slice(0,80), o=Math.max(0,Number(req.body.sort_order)||0); if(!q||!a)return res.status(400).json({error:'Question and answer are required'}); const r=await query("INSERT INTO faq_items(question,answer,category,sort_order,published) VALUES($1,$2,$3,$4,$5) RETURNING *",[q,a,c,o,req.body.published!==false]); res.json(r.rows[0]); });
app.patch("/api/admin/faq/:id",auth,admin,async(req,res)=>{ const id=Number(req.params.id); if(!Number.isInteger(id))return res.status(400).json({error:'Invalid FAQ id'}); const old=(await query("SELECT * FROM faq_items WHERE id=$1",[id])).rows[0]; if(!old)return res.status(404).json({error:'FAQ not found'}); const q=req.body.question!==undefined?String(req.body.question).trim():old.question, a=req.body.answer!==undefined?String(req.body.answer).trim():old.answer, c=req.body.category!==undefined?String(req.body.category).trim().slice(0,80):old.category, o=req.body.sort_order!==undefined?Math.max(0,Number(req.body.sort_order)||0):old.sort_order, pub=req.body.published!==undefined?!!req.body.published:old.published; if(!q||!a)return res.status(400).json({error:'Question and answer are required'}); const r=await query("UPDATE faq_items SET question=$1,answer=$2,category=$3,sort_order=$4,published=$5,updated_at=NOW() WHERE id=$6 RETURNING *",[q,a,c,o,pub,id]); res.json(r.rows[0]); });
app.delete("/api/admin/faq/:id",auth,admin,async(req,res)=>{ const id=Number(req.params.id); if(!Number.isInteger(id))return res.status(400).json({error:'Invalid FAQ id'}); const r=await query("DELETE FROM faq_items WHERE id=$1 RETURNING id",[id]); if(!r.rows[0])return res.status(404).json({error:'FAQ not found'}); res.json({ok:true,id}); });
app.get("/api/about",async(req,res)=>{
 const keys=['about_hero_title','about_hero_text','about_mission_title','about_mission_text','about_who_title','about_who_text','about_card1_title','about_card1_text','about_card2_title','about_card2_text','about_card3_title','about_card3_text','about_cta_title','about_cta_text'];
 const r=await query("SELECT key,value FROM academy_settings WHERE key=ANY($1::text[])",[keys]); const out={}; r.rows.forEach(x=>out[x.key]=x.value); res.json(out);
});
app.get("/api/settings",async(req,res)=>{
 const keys=String(req.query.keys||'').split(',').map(x=>x.trim()).filter(Boolean).slice(0,50);
 if(!keys.length)return res.json({});
 const r=await query("SELECT key,value FROM academy_settings WHERE key=ANY($1::text[])",[keys]); const out={}; r.rows.forEach(x=>out[x.key]=x.value); res.json(out);
});
app.get("/api/admin/settings",auth,admin,async(req,res)=>{
 const r=await query("SELECT key,value FROM academy_settings ORDER BY key"); const out={}; r.rows.forEach(x=>out[x.key]=x.value); res.json(out);
});
app.patch("/api/admin/settings",auth,admin,async(req,res)=>{
 const allowed=['academy_name','tagline','support_email','youtube_url','maintenance_mode','brand_logo_url','brand_favicon_url','brand_primary_color','brand_secondary_color','instagram_url','facebook_url','linkedin_url','x_url','whatsapp_url',
 'about_hero_title','about_hero_text','about_mission_title','about_mission_text','about_who_title','about_who_text',
 'about_card1_title','about_card1_text','about_card2_title','about_card2_text','about_card3_title','about_card3_text',
 'about_cta_title','about_cta_text',
 'nav_home','nav_courses','nav_learning','nav_resources','nav_tests','nav_dashboard','nav_plans','nav_about','nav_contact','nav_cta_label','nav_home_url','nav_courses_url','nav_learning_url','nav_resources_url','nav_tests_url','nav_dashboard_url','nav_plans_url','nav_about_url','nav_contact_url','nav_cta_url','footer_tagline','footer_copyright',
 'legal_privacy_title','legal_privacy_text','legal_terms_title','legal_terms_text','legal_refund_title','legal_refund_text','legal_disclaimer_title','legal_disclaimer_text','home_eyebrow','home_hero_title','home_hero_text','home_primary_label','home_primary_url','home_secondary_label','home_secondary_url','home_learning_label','home_learning_url','home_panel_label','home_panel_formula','home_feature1_title','home_feature1_text','home_feature1_url','home_feature2_title','home_feature2_text','home_feature2_url', 'seo_title','seo_description','seo_keywords','seo_robots','seo_og_title','seo_og_description','seo_og_image','seo_canonical','seo_google_verification'];
 for(const key of allowed){ if(req.body[key]!==undefined){ const value=String(req.body[key]).slice(0,500); await query("INSERT INTO academy_settings(key,value) VALUES($1,$2) ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value",[key,value]); }}
 const r=await query("SELECT key,value FROM academy_settings ORDER BY key"); const out={}; r.rows.forEach(x=>out[x.key]=x.value); res.json(out);
});

app.get("/api/admin/students/:id",auth,admin,async(req,res)=>{
 const id=Number(req.params.id);
 if(!Number.isInteger(id))return res.status(400).json({error:"Invalid student id"});
 const user=(await query("SELECT id,name,email,created_at FROM users WHERE id=$1 AND role='student'",[id])).rows[0];
 if(!user)return res.status(404).json({error:"Student not found"});
 const courses=(await query("SELECT course,created_at FROM enrollments WHERE user_id=$1 ORDER BY created_at DESC",[id])).rows;
 const progress=(await query("SELECT course,module_index,completed,updated_at FROM lesson_progress WHERE user_id=$1 ORDER BY course,module_index",[id])).rows;
 const results=(await query(`SELECT r.id,r.score,r.correct,r.total,r.created_at,t.title,t.course FROM test_results r JOIN tests t ON t.id=r.test_id WHERE r.user_id=$1 ORDER BY r.id DESC`,[id])).rows;
 const certificates=(await query("SELECT certificate_id,course,issued_at FROM certificates WHERE user_id=$1 ORDER BY issued_at DESC",[id])).rows;
 res.json({user,courses,progress,testHistory:results,certificates});
});
app.get("/api/admin/overview",auth,admin,async(req,res)=>{
 const students=Number((await query("SELECT COUNT(*)::int AS n FROM users WHERE role='student'")).rows[0].n);
 const enrollments=Number((await query("SELECT COUNT(*)::int AS n FROM enrollments")).rows[0].n);
 const tests=Number((await query("SELECT COUNT(*)::int AS n FROM tests WHERE published=1")).rows[0].n);
 const feedbackCount=Number((await query("SELECT COUNT(*)::int AS n FROM feedback")).rows[0].n);
 const avg=(await query("SELECT COALESCE(ROUND(AVG(rating),2),0) AS avg FROM feedback")).rows[0].avg;
 const certificates=Number((await query("SELECT COUNT(*)::int AS n FROM certificates")).rows[0].n);
 res.json({students,enrollments,tests,feedbackCount,averageRating:Number(avg),certificates});
});
app.get("/api/admin/analytics",auth,admin,async(req,res)=>{
 try{
  const [students,enrollments,tests,results,feedback,certificates,support,courseRows,monthlyRows]=await Promise.all([
   query("SELECT COUNT(*)::int AS n FROM users WHERE role='student'"),
   query("SELECT COUNT(*)::int AS n FROM enrollments"),
   query("SELECT COUNT(*)::int AS n FROM tests WHERE published=1"),
   query("SELECT COUNT(*)::int AS n, COALESCE(ROUND(AVG(score),2),0) AS avg FROM test_results"),
   query("SELECT COUNT(*)::int AS n, COALESCE(ROUND(AVG(rating),2),0) AS avg FROM feedback"),
   query("SELECT COUNT(*)::int AS n FROM certificates"),
   query("SELECT COUNT(*)::int AS n, COUNT(*) FILTER (WHERE status='open')::int AS open, COUNT(*) FILTER (WHERE status='in_progress')::int AS in_progress, COUNT(*) FILTER (WHERE status='resolved')::int AS resolved FROM support_requests"),
   query("SELECT course,COUNT(*)::int AS students FROM enrollments GROUP BY course ORDER BY students DESC,course"),
   query(`SELECT TO_CHAR(d,'Mon') AS month, EXTRACT(MONTH FROM d)::int AS month_num, EXTRACT(YEAR FROM d)::int AS year_num, COUNT(u.id)::int AS registrations FROM generate_series(date_trunc('month',NOW())-interval '5 months',date_trunc('month',NOW()),interval '1 month') d LEFT JOIN users u ON u.role='student' AND u.created_at>=d AND u.created_at<d+interval '1 month' GROUP BY d ORDER BY d`)
  ]);
  const progressRows=await query("SELECT COUNT(DISTINCT user_id)::int AS learners, COUNT(DISTINCT user_id||'|'||course||'|'||module_index)::int AS completions FROM lesson_progress WHERE completed::text IN ('1','true')");
  res.json({summary:{students:Number(students.rows[0].n),enrollments:Number(enrollments.rows[0].n),publishedTests:Number(tests.rows[0].n),testAttempts:Number(results.rows[0].n),averageTestScore:Number(results.rows[0].avg),feedbackCount:Number(feedback.rows[0].n),averageRating:Number(feedback.rows[0].avg),certificates:Number(certificates.rows[0].n),supportTickets:Number(support.rows[0].n),openSupport:Number(support.rows[0].open),inProgressSupport:Number(support.rows[0].in_progress),resolvedSupport:Number(support.rows[0].resolved),activeLearners:Number(progressRows.rows[0].learners),moduleCompletions:Number(progressRows.rows[0].completions)},courseEnrollments:courseRows.rows,monthlyRegistrations:monthlyRows.rows});
 }catch(e){console.error(e);res.status(500).json({error:"Unable to load analytics"});}
});
app.get("/api/admin/students",auth,admin,async(req,res)=>{
 const users=(await query("SELECT id,name,email,role,created_at FROM users WHERE role='student' ORDER BY id DESC")).rows;
 const out=[];
 for(const u of users){
  const courses=(await query("SELECT course FROM enrollments WHERE user_id=$1",[u.id])).rows.map(x=>x.course);
  const done=(await query("SELECT COUNT(DISTINCT course || '|' || module_index)::int AS n FROM lesson_progress WHERE user_id=$1 AND completed::text IN ('1','true')",[u.id])).rows[0].n;
  const latest=(await query("SELECT score,created_at FROM test_results WHERE user_id=$1 ORDER BY id DESC LIMIT 1",[u.id])).rows[0]||null;
  out.push({...u,courses,completedModules:done,progress:Math.min(100,done*25),latestTest:latest});
 }
 res.json(out);
});


async function seedDefaultContent(){
  const seedCourses=[
  ["B.Tech Mathematics","btech-mathematics","Engineering Mathematics for B.Tech learners","B.Tech",["Differential Equations","Laplace Transforms","Vector Calculus","Probability & Random Variables"]],
  ["Intermediate Mathematics","intermediate-mathematics","Concepts, problem solving and exam preparation","Intermediate",["Mathematical Foundations","Core Mathematics","Problem Solving","Revision & Preparation"]],
  ["Class 10 Mathematics","class-10-mathematics","Strong fundamentals and board-focused practice","Class 10",["Foundations & Concepts","Core Mathematics","Problem Solving","Revision & Preparation"]],
  ["Classes 5–7 Mathematics","classes-5-7-mathematics","Build confident number skills and core concepts","Classes 5–7",["Number Skills","Core Concepts","Problem Solving","Revision & Practice"]]
 ];
 for(const [name,slug,description,level,mods] of seedCourses){
  const c=await query("SELECT id FROM courses WHERE slug=$1 LIMIT 1",[slug]);let cid=c.rows[0]?.id;
  if(!cid){const r=await query("INSERT INTO courses(name,slug,description,level,published) VALUES($1,$2,$3,$4,1) RETURNING id",[name,slug,description,level]);cid=r.rows[0].id;}
  for(let i=0;i<mods.length;i++) await query("INSERT INTO course_modules(course_id,title,module_index,published) VALUES($1,$2,$3,1) ON CONFLICT DO NOTHING",[cid,mods[i],i+1]);
 }
  const video = await query("SELECT id FROM videos WHERE video_id=$1 LIMIT 1",["SGokvzWeqvk"]);
  if(!video.rows.length){
    await query(`INSERT INTO videos(title,course,module,youtube_url,video_id,description,published)
      VALUES($1,$2,$3,$4,$5,$6,1)`,[
      "Random Variable in 10 Seconds! 🤯 | B.Tech Maths | Easy Explanation | Settlem Academy",
      "B.Tech Mathematics","Probability & Random Variables",
      "https://www.youtube.com/watch?v=SGokvzWeqvk","SGokvzWeqvk",
      "A quick and simple introduction to random variables for B.Tech Mathematics students."
    ]);
  }

  // Ensure the seeded Probability test is always exactly 20 questions.
  // This is intentionally idempotent so an existing 10-question test is upgraded
  // reliably on every server restart without affecting submitted test_results.
  const TEST_TITLE="B.Tech Mathematics – Probability & Random Variables | Practice Test 1";
  const TEST_INSTRUCTIONS="20 important multiple-choice questions covering Probability & Random Variables. Choose the best answer. Your score is calculated instantly.";
  const tr=await query("SELECT id FROM tests WHERE title=$1 LIMIT 1",[TEST_TITLE]);
  let testId=tr.rows[0]?.id;
  if(!testId){
    const r=await query(`INSERT INTO tests(title,course,instructions,published) VALUES($1,$2,$3,1) RETURNING id`,[
      TEST_TITLE,"B.Tech Mathematics",TEST_INSTRUCTIONS
    ]);
    testId=r.rows[0].id;
  } else {
    await query("UPDATE tests SET instructions=$1,published=1 WHERE id=$2",[TEST_INSTRUCTIONS,testId]);
  }
  const qs=[
    ["A random variable is best described as:","A numerical function assigning a value to each outcome","A sample space","A probability only","An event only",0],
    ["If X is a discrete random variable, the sum of P(X=x) over all possible x is:","0","1","∞","Depends on X",1],
    ["For a fair coin tossed once, if X=1 for Head and X=0 for Tail, E[X] is:","0","1/4","1/2","1",2],
    ["The variance of a random variable X is:","E[X] + (E[X])²","E[X²] − (E[X])²","E[X²] + E[X]","(E[X])² − E[X²]",1],
    ["If P(A)=0.4 and P(B)=0.5 and A,B are independent, P(A∩B) is:","0.1","0.2","0.4","0.9",1],
    ["For a Bernoulli random variable with success probability p, its mean is:","1−p","p","p²","1/p",1],
    ["For a binomial random variable X~Bin(n,p), E[X] equals:","np","n/p","p/n","n(1−p)",0],
    ["For X~Bin(n,p), Var(X) equals:","np","np²","np(1−p)","n²p(1−p)",2],
    ["A probability mass function is used for:","Continuous random variables only","Discrete random variables","Only normal distributions","Only uniform distributions",1],
    ["If E[X]=3 and E[X²]=13, then Var(X) is:","4","9","10","16",0],
    ["If P(A)=0.6, P(B)=0.5 and P(A∩B)=0.3, then A and B are:","Independent","Mutually exclusive","Impossible","Complements",0],
    ["Bayes’ theorem is mainly used to:","Find a sample space","Reverse conditional probabilities using prior information","Calculate only variance","Find a PDF directly",1],
    ["For a continuous random variable X, P(X=a) is:","1","a","0","Depends on a",2],
    ["If f(x) is a valid PDF, its total area over its support is:","0","1","∞","−1",1],
    ["For a discrete random variable, E[X] is calculated by:","Σx/p(x)","Σxp(x)","∫f(x)dx only","Σp(x)/x",1],
    ["If X~Poisson(λ), then E[X] and Var(X) are:","λ and λ","λ and λ²","λ² and λ","1 and λ",0],
    ["For X~Bin(n,p), q is:","p+1","1+p","1−p","1/p",2],
    ["If X~Bin(10,0.2), its mean is:","0.2","2","5","8",1],
    ["If E[X]=4 and Var(X)=3, E[X²] equals:","7","12","19","25",2],
    ["If X is uniform on (0,1), then P(0.2<X<0.6) is:","0.2","0.4","0.6","0.8",1]
  ];
  // Rebuild only the seeded test's questions. Existing submitted results remain intact
  // because test_results reference the test, not individual questions.
  await query("DELETE FROM questions WHERE test_id=$1",[testId]);
  for(const q of qs){
    await query(`INSERT INTO questions(test_id,question,option_a,option_b,option_c,option_d,correct_index)
      VALUES($1,$2,$3,$4,$5,$6,$7)`,[testId,...q]);
  }

  const materials=[
    ["B.Tech Mathematics – Probability & Random Variables Quick Notes","Chapter Notes","btech-study-notes.html#probability","Definitions, random variables, distributions and key concepts in one place."],
    ["B.Tech Mathematics – Probability Formula Sheet","Formula Sheet","btech-study-notes.html#formulas","Important probability and random-variable formulas for quick revision."],
    ["B.Tech Mathematics – 20 Important Problems","Important Questions","btech-study-notes.html#problems","A focused list of high-value problems for B.Tech exam preparation."],
    ["B.Tech Mathematics – Test Preparation Pack","Test Preparation","practice-tests.html","Use this resource with Practice Test 1 to check your preparation."]
  ]
  for(const [title,type,url,description] of materials){
    const m=await query("SELECT id FROM materials WHERE title=$1 LIMIT 1",[title]);
    if(!m.rows.length) await query(`INSERT INTO materials(title,course,type,url,description,published) VALUES($1,$2,$3,$4,$5,1)`,[title,"B.Tech Mathematics",type,url,description]);
    else await query("UPDATE materials SET url=$1,description=$2,published=1 WHERE id=$3",[url,description,m.rows[0].id]);
  }

  const brandDefaults={academy_name:'Settlem Academy',tagline:'Learn Mathematics • Build Confidence • Achieve Success',brand_logo_url:'settlem-academy-logo.png',brand_favicon_url:'settlem-academy-logo.png',brand_primary_color:'#3157d5',brand_secondary_color:'#4338ca',instagram_url:'',facebook_url:'',linkedin_url:'',x_url:'',whatsapp_url:''};
  for(const [key,value] of Object.entries(brandDefaults)){ await query("INSERT INTO academy_settings(key,value) VALUES($1,$2) ON CONFLICT(key) DO NOTHING",[key,value]); }
  const homeDefaults={home_eyebrow:'A MODERN MATHEMATICS LEARNING PLATFORM',home_hero_title:'Understand Maths. Achieve More.',home_hero_text:'Settlem Academy helps students learn mathematics through clear explanations, structured courses, useful resources and consistent practice.',home_primary_label:'Explore Courses →',home_primary_url:'#courses',home_secondary_label:'How We Teach',home_secondary_url:'#learning',home_learning_label:'Start Learning',home_learning_url:'course-enrollment.html',home_panel_label:'LEARNING • 01',home_panel_formula:'Concepts → Clarity\nClarity → Practice\nPractice → Confidence\nConfidence → Success',home_feature1_title:'Learn from Settlem Academy',home_feature1_text:'Discover mathematics lessons with step-by-step explanations and practical problem solving.',home_feature1_url:'video-lessons.html',home_feature2_title:'Revise with confidence',home_feature2_text:'Keep important notes, formulas, questions and revision resources organised in one place.',home_feature2_url:'#resources'};
  for(const [key,value] of Object.entries(homeDefaults)){ await query("INSERT INTO academy_settings(key,value) VALUES($1,$2) ON CONFLICT(key) DO NOTHING",[key,value]); }

  const navigationDefaults={nav_home:'Home',nav_courses:'Courses',nav_learning:'Learning',nav_resources:'Resources',nav_tests:'Tests',nav_dashboard:'Dashboard',nav_plans:'Plans',nav_about:'About',nav_contact:'Contact',nav_cta_label:'Start Learning',nav_home_url:'index.html#home',nav_courses_url:'index.html#courses',nav_learning_url:'video-lessons.html',nav_resources_url:'study-materials.html',nav_tests_url:'practice-tests.html',nav_dashboard_url:'student-dashboard.html',nav_plans_url:'subscriptions.html',nav_about_url:'about.html',nav_contact_url:'contact.html',nav_cta_url:'student-login.html',footer_tagline:'Learn Mathematics • Build Confidence • Achieve Success',footer_copyright:'© 2026 Settlem Academy'};
  for(const [key,value] of Object.entries(navigationDefaults)){ await query("INSERT INTO academy_settings(key,value) VALUES($1,$2) ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value",[key,value]); }

  const aboutDefaults={
    about_hero_title:'Making mathematics easier to understand.',
    about_hero_text:'Settlem Academy is a mathematics learning platform built around one simple idea: when students understand the concept clearly, practice it consistently and revise with purpose, confidence follows.',
    about_mission_title:'Build stronger maths skills, one concept at a time.',
    about_mission_text:'We want mathematics to feel approachable, structured and achievable. The goal is not simply to finish a chapter, but to help students develop understanding they can use in the next chapter, the next exam and beyond.',
    about_who_title:'A focused learning space for students at every stage.',
    about_who_text:'Settlem Academy brings structured mathematics learning into one place, from school foundations to higher-level B.Tech mathematics.',
    about_card1_title:'Clear Concepts', about_card1_text:'Lessons are designed to explain the idea first, so students know why a method works before applying it.',
    about_card2_title:'Guided Practice', about_card2_text:'Worked examples and carefully selected problems help students turn understanding into problem-solving ability.',
    about_card3_title:'Exam Confidence', about_card3_text:'Revision-focused resources and important problems help learners prepare with a more organised approach.',
    about_cta_title:'Ready to start learning?', about_cta_text:'Explore the courses, choose your learning path and take the next step with Settlem Academy.'
  };
  for(const [key,value] of Object.entries(aboutDefaults)){
    await query("INSERT INTO academy_settings(key,value) VALUES($1,$2) ON CONFLICT(key) DO NOTHING",[key,value]);
  }
}

initDb().then(()=>seedDefaultContent()).then(()=>app.listen(PORT,()=>console.log(`Settlem Academy API running on port ${PORT}`))).catch(err=>{console.error("Database initialization failed",err);process.exit(1)});
process.on("SIGTERM",async()=>{await pool.end();process.exit(0)});
