import { name } from 'ejs';
import User from '../../models/userSchema.js';
import bcrypt from 'bcrypt';

class CustomerService {
    async getUsers(search, page, limit) {
        page = parseInt(page)
        let query = { isAdmin: false };
        // Search filter
        if (search) {
            query.$or = [
                { name: { $regex: ".*" + search + ".*", $options: 'i' } },
                { email: { $regex: ".*" + search + ".*", $options: 'i' } },
            ];
        }
        const skip = (page - 1) * limit;

        const users = await User.find(query)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        const total = await User.countDocuments(query);

        return { users, totalPages: Math.ceil(total / limit) };
    }

    async blockCustomer(id) {
        return await User.updateOne({ _id: id }, { $set: { isBlocked: true } });
    }

    async unblockCustomer(id) {
        return await User.updateOne({ _id: id }, { $set: { isBlocked: false } });
    }
}

export default new CustomerService();
