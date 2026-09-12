require("dotenv").config();
const bcrypt = require("bcryptjs");
const Database = require("better-sqlite3");
const db = new Database("settlem-academy.db");

const name=process.env.ADMIN_NAME, email=process.env.ADMIN_EMAIL, password=process.env.ADMIN_PASSWORD;
if(!name || !email || !password){console.error("Missing ADMIN_NAME, ADMIN_EMAIL or ADMIN_PASSWORD in .env");process.exit(1);}
if(password.length<8){console.error("ADMIN_PASSWORD must be at least 8 characters.");process.exit(1);}
const hash=bcrypt.hashSync(password,12);
const existing=db.prepare("SELECT id FROM users WHERE email=?").get(email);
if(existing){
  db.prepare("UPDATE users SET name=?,password_hash=?,role='admin' WHERE id=?").run(name,hash,existing.id);
  console.log("Admin account updated:",email);
}else{
  const result=db.prepare("INSERT INTO users (name,email,password_hash,role) VALUES (?,?,?,'admin')").run(name,email,hash);
  console.log("Admin account created:",email,"id:",result.lastInsertRowid);
}
db.close();
