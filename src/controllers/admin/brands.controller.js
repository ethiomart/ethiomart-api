const { Brand, Product } = require('../../models');

/**
 * Get all brands
 */
exports.getBrands = async (req, res, next) => {
  try {
    const brands = await Brand.findAll({
      order: [['name', 'ASC']]
    });
    res.json({ success: true, data: brands });
  } catch (error) {
    next(error);
  }
};

/**
 * Create brand
 */
exports.createBrand = async (req, res, next) => {
  try {
    const { name, slug, description } = req.body;
    const logo = req.file ? req.file.path : null;

    const brand = await Brand.create({
      name,
      slug,
      description,
      logo
    });

    res.status(201).json({ success: true, data: brand });
  } catch (error) {
    next(error);
  }
};

/**
 * Update brand
 */
exports.updateBrand = async (req, res, next) => {
  try {
    const { name, slug, description, is_active } = req.body;
    const brand = await Brand.findByPk(req.params.id);

    if (!brand) {
      return res.status(404).json({ success: false, message: 'Brand not found' });
    }

    const updateData = { name, slug, description, is_active };
    if (req.file) {
      updateData.logo = req.file.path;
    }

    await brand.update(updateData);

    res.json({ success: true, data: brand });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete brand
 */
exports.deleteBrand = async (req, res, next) => {
  try {
    const brand = await Brand.findByPk(req.params.id);
    if (!brand) {
      return res.status(404).json({ success: false, message: 'Brand not found' });
    }

    const productCount = await Product.count({ where: { brand_id: brand.id } });
    if (productCount > 0) {
      return res.status(400).json({ success: false, message: 'Cannot delete brand with associated products' });
    }

    await brand.destroy();
    res.json({ success: true, message: 'Brand deleted successfully' });
  } catch (error) {
    next(error);
  }
};
