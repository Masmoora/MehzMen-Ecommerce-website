import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import UserService from '../service/user/userService.js';
import env from 'dotenv';
env.config();

passport.use(
    new GoogleStrategy(
        {
            clientID: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            callbackURL: process.env.GOOGLE_CALLBACK_URL
        },
        async (accessToken, refreshToken, profile, done) => {
            try {
                const user = await UserService.findOrCreateGoogleUser(profile);
                
//  Blocked user
                if (!user) {
                    return done(null, false, {
                        message: 'Your account has been blocked by admin'
                    });
                }

                return done(null, user);
            } catch (error) {
                return done(error, null);
            }
        }
    )
);

passport.serializeUser((user, done) => {
    done(null, user._id);
});

passport.deserializeUser(async (id, done) => {
    try {
        const user = await UserService.getUserById(id);
        
        done(null, user);
    } catch (err) {
        done(err, null);
    }
});

export default passport;