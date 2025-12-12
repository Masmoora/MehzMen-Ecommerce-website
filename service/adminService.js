import User from '../models/userSchema.js';
import bcrypt from 'bcrypt';

class AdminService {
    async findAdminByEmail(email) {
        return await User.findOne({email, isAdmin: true});
    }

    async comparePassword(plainPass,hashedPass) {
        return await bcrypt.compare(plainPass,hashedPass);
    }

}
export default new AdminService();