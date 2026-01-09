import { name } from 'ejs';
import Brand from '../../models/brandSchema.js';

class BrandService {

    getBrands = async (search, page, limit) => {
        const skip = (page - 1) * limit;

        const query = { $or: [{ name: { $regex: ".*" + search + ".*", $options: "i" } }] }

        const brands = await Brand.find(query)
            .skip(skip)
            .limit(limit)
            .sort({ createdAt: -1 });

        const count = await Brand.countDocuments(query);
        const totalPages = Math.ceil(count / limit);

        return { brands, totalPages };
    };


    createBrand = async (data) => {
        return await Brand.create(data);
    };

    async findbrandByName(name) {
        return await Brand.findOne({

            name: { $regex: `^${name}$`, $options: "i" }
        })
    }

    async updateBrand(id, updateData) {
        return await Brand.findByIdAndUpdate(id, updateData, { new: true });
    }

    async toggleBrandStatus(brandId) {
        const brand = await Brand.findById(brandId);

        if (!brand) {
            throw new Error("Brand not found");
        }

        brand.isListed = !brand.isListed;
        await brand.save();

        return brand.isListed;
    }
       async getAllBrands() {
    return await Brand.find({ isListed: true }).lean();
  }

}




export default new BrandService();