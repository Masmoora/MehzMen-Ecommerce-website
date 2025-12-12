import User from '../models/userSchema.js';
import bcrypt from 'bcrypt';

class UserService {
    //check existing user
    async findByEmail(email) {
        return await User.findOne({ email });
    }

    //create new user
    async createUser(data) {
        return await User.create(data);
    }
    //find user by googleid or email
    async findOrCreateGoogleUser(profile) {
        const filter = {
            $or: [
                { googleId: profile.id },
                { email: profile.emails[0].value.toLowerCase() }
            ]
        };

        const update = {
            name: profile.displayName,
            email: profile.emails[0].value.toLowerCase(),
            googleId: profile.id,
        };

        const options = { new: true, upsert: true };

        const user = await User.findOneAndUpdate(filter, update, options);
        return user;
    }

    async getUserById(id) {
        return await User.findById(id);
    }

    async findUserByEmail(email) {
        return await User.findOne({email,isAdmin:0});
    }

    async validatePassword(plainPassword, hashedPassword) {
        return await bcrypt.compare(plainPassword,hashedPassword);
    }
}

export default new UserService();