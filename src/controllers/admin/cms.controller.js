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
    console.log('Create Banner Request:', {
      contentType: req.headers['content-type'],
      body: req.body,
      file: req.file ? req.file.originalname : 'Missing',
      fileUrl: req.fileUrl
    });

    const { 
      title, 
      linkValue, 
      linkType,
      position, 
      sortOrder, 
      startDate, 
      endDate, 
      status 
    } = req.body;

    if (!req.file) {
      console.log('Validation Error: Banner image is required but missing.');
      return res.status(400).json({ success: false, message: 'Banner image is required' });
    }

    const banner = await Banner.create({
      title,
      image_url: req.fileUrl || req.file.path,
      link_url: linkValue, // Mapping linkValue to link_url
      position,
      sort_order: sortOrder || 0,
      start_date: startDate,
      end_date: endDate || null,
      is_active: status === 'active'
    });

    res.status(201).json({ success: true, data: banner });
  } catch (error) {
    console.error('Create Banner Error:', error);
    next(error);
  }
};

exports.updateBanner = async (req, res, next) => {
  try {
    console.log(`Update Banner Request for ID ${req.params.id}:`, {
      contentType: req.headers['content-type'],
      body: req.body,
      file: req.file ? req.file.originalname : 'Not changed'
    });
    const { 
      title, 
      linkValue, 
      linkType,
      position, 
      sortOrder, 
      startDate, 
      endDate, 
      status 
    } = req.body;
    
    const banner = await Banner.findByPk(req.params.id);

    if (!banner) {
      return res.status(404).json({ success: false, message: 'Banner not found' });
    }

    const updateData = { 
      title, 
      link_url: linkValue, 
      position, 
      sort_order: sortOrder,
      start_date: startDate,
      end_date: endDate || null,
      is_active: status === 'active'
    };

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
