import express from 'express';
import app from express();
import env from 'dotenv';
env.config();
import session from 'express-session';
import passport from './config/passport.js';
import connectDB from './config/db.js';
import path from 'path';
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
    maxAge:process.env.MAX_AGE
  }
}));

//passport middleware
app.use(passport.initialize());
app.use(passport.session());

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