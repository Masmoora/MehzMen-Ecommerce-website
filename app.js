import express from 'express';
const app = express();
import env from 'dotenv';
env.config();
import session from 'express-session';
import passport from './config/passport.js';
import connectDB from './config/db.js';
import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import userRouter from './routes/userRouter.js';
import adminRouter from './routes/adminRouter.js';

connectDB();
app.use(express.json());
app.use(express.urlencoded({extended:true}));

//session middleware
app.use(session({
  secret:process.env.SESSION_SECRET,
  resave:false,
  saveUninitialized:true,
  cookie:{
    secure:false,
    httpOnly:true,
    maxAge:Number(process.env.MAX_AGE)||0
  }
}));

//passport middleware
app.use(passport.initialize());
app.use(passport.session());

app.use((req,res,next)=>{
    res.set('cache-control','no-store')
    next();
});

//view engine setting
app.set('view engine','ejs');
app.set('views',[path.join(__dirname,'views/user'),path.join(__dirname,'views/admin')]);
app.use(express.static(path.join(__dirname,'public')));

//routes
app.use('/',userRouter);
app.use('/admin',adminRouter);

app.listen(process.env.PORT,()=>{
  console.log('Server Running');
});

export default app;