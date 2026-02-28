const { Attribute, AttributeValue } = require('../../models');

/**
 * Get all attributes
 */
exports.getAttributes = async (req, res, next) => {
  try {
    const attributes = await Attribute.findAll({
      include: [
        {
          model: AttributeValue,
          as: 'values',
          attributes: ['id', 'value', 'color_code', 'sort_order']
        }
      ],
      order: [['name', 'ASC'], [{ model: AttributeValue, as: 'values' }, 'sort_order', 'ASC']]
    });

    res.status(200).json({ success: true, data: attributes });
  } catch (error) {
    next(error);
  }
};

/**
 * Create attribute
 */
exports.createAttribute = async (req, res, next) => {
  try {
    const { name, type, is_filterable, values } = req.body;

    const attribute = await Attribute.create({
      name,
      type,
      is_filterable
    });

    if (values && Array.isArray(values)) {
      const valuePromises = values.map((val, index) => {
        return AttributeValue.create({
          attribute_id: attribute.id,
          value: typeof val === 'string' ? val : val.value,
          color_code: val.color_code || null,
          sort_order: val.sort_order || index
        });
      });
      await Promise.all(valuePromises);
    }

    const createdAttribute = await Attribute.findByPk(attribute.id, {
      include: [{ model: AttributeValue, as: 'values' }]
    });

    res.status(201).json({ success: true, data: createdAttribute });
  } catch (error) {
    next(error);
  }
};

/**
 * Update attribute
 */
exports.updateAttribute = async (req, res, next) => {
  try {
    const { name, type, is_filterable, values } = req.body;
    const attribute = await Attribute.findByPk(req.params.id);

    if (!attribute) {
      return res.status(404).json({ success: false, message: 'Attribute not found' });
    }

    await attribute.update({ name, type, is_filterable });

    if (values && Array.isArray(values)) {
      // Simple approach: delete old values and create new ones
      // In production, we'd want to sync (update existing, delete missing, create new)
      await AttributeValue.destroy({ where: { attribute_id: attribute.id } });
      
      const valuePromises = values.map((val, index) => {
        return AttributeValue.create({
          attribute_id: attribute.id,
          value: typeof val === 'string' ? val : val.value,
          color_code: val.color_code || null,
          sort_order: val.sort_order || index
        });
      });
      await Promise.all(valuePromises);
    }

    const updatedAttribute = await Attribute.findByPk(attribute.id, {
      include: [{ model: AttributeValue, as: 'values' }]
    });

    res.status(200).json({ success: true, data: updatedAttribute });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete attribute
 */
exports.deleteAttribute = async (req, res, next) => {
  try {
    const attribute = await Attribute.findByPk(req.params.id);
    if (!attribute) {
      return res.status(404).json({ success: false, message: 'Attribute not found' });
    }

    await attribute.destroy();
    res.status(200).json({ success: true, message: 'Attribute deleted successfully' });
  } catch (error) {
    next(error);
  }
};
