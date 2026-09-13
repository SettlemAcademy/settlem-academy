require("dotenv").config();
const bcrypt=require("bcryptjs");
const {Pool}=require("pg");
const pool=new Pool({connectionString:process.env.DATABASE_URL,ssl:process.env.DATABASE_URL?{rejectUnauthorized:false}:false});
(async()=>{
 const name=process.env.ADMIN_NAME||"Settlem Academy Admin";
 const email=process.env.ADMIN_EMAIL;
 const password=process.env.ADMIN_PASSWORD;
 if(!process.env.DATABASE_URL||!email||!password)throw new Error("DATABASE_URL, ADMIN_EMAIL and ADMIN_PASSWORD are required");
 const hash=bcrypt.hashSync(password,12);
 await pool.query(`CREATE TABLE IF NOT EXISTS users(id SERIAL PRIMARY KEY,name TEXT NOT NULL,email TEXT NOT NULL UNIQUE,password_hash TEXT NOT NULL,role TEXT NOT NULL DEFAULT 'student',created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`);
 await pool.query(`INSERT INTO users(name,email,password_hash,role) VALUES($1,$2,$3,'admin') ON CONFLICT(email) DO UPDATE SET name=EXCLUDED.name,password_hash=EXCLUDED.password_hash,role='admin'`,[name,email.toLowerCase(),hash]);
 console.log(`Admin account ready: ${email}`);
 await pool.end();
})().catch(async err=>{console.error(err);await pool.end();process.exit(1)});
