/**
 * CustomProducts Data Collection Definition
 * 
 * This file defines the schema, field types, and permissions for the
 * CustomProducts collection. When the app is installed on a Wix site,
 * this collection is automatically created in the CMS.
 */
export default {
  idSuffix: 'CustomProducts',
  displayName: 'Custom Products',
  displayField: 'productName',
  fields: [
    {
      key: 'productName',
      displayName: 'Product Name',
      type: 'TEXT',
      description: 'Name of the custom product',
    },
    {
      key: 'shortDescription',
      displayName: 'Short Description',
      type: 'TEXT',
      description: 'Brief product description',
    },
    {
      key: 'basePrice',
      displayName: 'Base Price',
      type: 'NUMBER',
      description: 'Base price of the product',
    },
    {
      key: 'discountPrice',
      displayName: 'Discount Price',
      type: 'NUMBER',
      description: 'Optional discounted price',
    },
    {
      key: 'image',
      displayName: 'Product Image',
      type: 'IMAGE',
      description: 'Product image from Wix Media Manager',
    },
    {
      key: 'configurators',
      displayName: 'Configurators',
      type: 'OBJECT',
      description: 'JSON object for dynamic configurator groups and options',
    },
    {
      key: 'status',
      displayName: 'Status',
      type: 'TEXT',
      description: 'Product status: Active or Draft',
    },
  ],
  dataPermissions: {
    itemRead: 'ANYONE',
    itemInsert: 'ANYONE',
    itemUpdate: 'ANYONE',
    itemRemove: 'ANYONE',
  },
};
