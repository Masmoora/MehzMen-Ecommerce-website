const passport=require('passport')
const GoogleStrategy=require('passport-google-oauth20').Strategy;
const User=require('../models/userSchema')
const env = require('dotenv').config()

passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: '/auth/google/callback'
},
async (accessToken, refreshToken, profile, done) => {
  try {
    const user = await User.findOneAndUpdate(
      { $or: [{ googleId: profile.id }, { email: profile.emails[0].value.toLowerCase() }] }, // search condition
      {
        $set: {
          name: profile.displayName,
          email: profile.emails[0].value.toLowerCase(),
          googleId: profile.id
        }
      },
      { upsert: true, new: true } // if not found, create new
    );

    return done(null, user);
  } catch (error) {
    return done(error, null);
  }
}
));

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser((id, done) => {
  User.findById(id)
    .then(user => {
      done(null, user);
    })
    .catch(err => {
      done(err,null)
    })
});

module.exports = passport;