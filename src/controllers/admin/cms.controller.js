const { Banner, StaticPage, sequelize } = require('../../models');
const { deleteFromCloudinary } = require('../../utils/cloudinaryUtils');

/**
 * Banners
 */
exports.getBanners = async (req, res, next) => {
  try {
    const banners = await Banner.findAll({
      order: [['sort_order', 'ASC']]
    });
    res.json({ success: true, data: banners });
  } catch (error) {
    next(error);
  }
};

exports.createBanner = async (req, res, next) => {
  try {
    const { title, link_url, position, sort_order } = req.body;
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Banner image is required' });
    }

    const banner = await Banner.create({
      title,
      image_url: req.fileUrl || req.file.path,
      link_url,
      position,
      sort_order: sort_order || 0
    });

    res.status(201).json({ success: true, data: banner });
  } catch (error) {
    next(error);
  }
};

exports.updateBanner = async (req, res, next) => {
  try {
    const { title, link_url, position, sort_order, is_active } = req.body;
    const banner = await Banner.findByPk(req.params.id);

    if (!banner) {
      return res.status(404).json({ success: false, message: 'Banner not found' });
    }

    const updateData = { title, link_url, position, sort_order, is_active };
    if (req.file) {
      // Delete old image from Cloudinary if it exists
      if (banner.image_url) {
        await deleteFromCloudinary(banner.image_url);
      }
      updateData.image_url = req.fileUrl || req.file.path;
    }

    await banner.update(updateData);
    res.json({ success: true, data: banner });
  } catch (error) {
    next(error);
  }
};

exports.deleteBanner = async (req, res, next) => {
  try {
    const banner = await Banner.findByPk(req.params.id);
    if (!banner) {
      return res.status(404).json({ success: false, message: 'Banner not found' });
    }

    // Delete image from Cloudinary before destroying banner
    if (banner.image_url) {
      await deleteFromCloudinary(banner.image_url);
    }

    await banner.destroy();
    res.json({ success: true, message: 'Banner deleted successfully' });
  } catch (error) {
    next(error);
  }
};

exports.reorderBanners = async (req, res, next) => {
  try {
    const { order } = req.body;
    
    await sequelize.transaction(async (t) => {
      for (const item of order) {
        await Banner.update(
          { sort_order: item.sort_order },
          { where: { id: item.id }, transaction: t }
        );
      }
    });

    res.json({ success: true, message: 'Banners reordered successfully' });
  } catch (error) {
    next(error);
  }
};

/**
 * Static Pages
 */
exports.getPages = async (req, res, next) => {
  try {
    const pages = await StaticPage.findAll({
      order: [['title', 'ASC']]
    });
    res.json({ success: true, data: pages });
  } catch (error) {
    next(error);
  }
};

exports.getPageById = async (req, res, next) => {
  try {
    const page = await StaticPage.findByPk(req.params.id);
    if (!page) {
      return res.status(404).json({ success: false, message: 'Page not found' });
    }
    res.json({ success: true, data: page });
  } catch (error) {
    next(error);
  }
};

exports.updatePage = async (req, res, next) => {
  try {
    const { title, content, meta_title, meta_description, is_active } = req.body;
    const page = await StaticPage.findByPk(req.params.id);

    if (!page) {
      return res.status(404).json({ success: false, message: 'Page not found' });
    }

    await page.update({
      title,
      content,
      meta_title,
      meta_description,
      is_active
    });

    res.json({ success: true, data: page });
  } catch (error) {
    next(error);
  }
};
