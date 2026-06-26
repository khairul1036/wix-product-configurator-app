import { webMethod, Permissions } from '@wix/web-methods';
import { collections, items } from '@wix/data';
import { auth } from '@wix/essentials';
import { Product } from './types';

const COLLECTION_ID = 'CustomProducts';

// Elevate data item operations so that CRUD works
// regardless of the visiting user's site-level role.
const elevatedQuery = auth.elevate(items.query);
const elevatedGet = auth.elevate(items.get);
const elevatedInsert = auth.elevate(items.insert);
const elevatedUpdate = auth.elevate(items.update);
const elevatedRemove = auth.elevate(items.remove);

// Elevate collection-level operations for auto-provisioning
const elevatedGetCollection = auth.elevate(collections.getDataCollection);
const elevatedCreateCollection = auth.elevate(collections.createDataCollection);

// ------------------------------------------------------------------
// Auto-provisioning: create collection if it doesn't exist
// ------------------------------------------------------------------

let collectionReady = false; // Cache so we only check once per server lifecycle

async function ensureCollectionExists(): Promise<void> {
  if (collectionReady) return;

  try {
    // Check if collection already exists
    await elevatedGetCollection(COLLECTION_ID);
    collectionReady = true;
  } catch (_checkError: any) {
    // Collection doesn't exist – create it
    console.log('CustomProducts collection not found. Creating...');
    try {
      await elevatedCreateCollection({
        _id: COLLECTION_ID,
        displayName: 'Custom Products',
        fields: [
          { key: 'productName', displayName: 'Product Name', type: 'TEXT' },
          { key: 'shortDescription', displayName: 'Short Description', type: 'TEXT' },
          { key: 'basePrice', displayName: 'Base Price', type: 'NUMBER' },
          { key: 'discountPrice', displayName: 'Discount Price', type: 'NUMBER' },
          { key: 'image', displayName: 'Product Image', type: 'IMAGE' },
          { key: 'configurators', displayName: 'Configurators', type: 'OBJECT' },
          { key: 'status', displayName: 'Status', type: 'TEXT' },
        ],
        permissions: {
          insert: 'ANYONE',
          read: 'ANYONE',
          update: 'ANYONE',
          remove: 'ANYONE',
        },
      } as any);
      collectionReady = true;
      console.log('CustomProducts collection created successfully.');
    } catch (createError: any) {
      console.error('Failed to auto-create collection:', createError);
      // Race condition: another request may have created it already
      try {
        await elevatedGetCollection(COLLECTION_ID);
        collectionReady = true;
      } catch (_finalError) {
        throw new Error(
          'Could not find or create CustomProducts collection. ' +
          'Please create a "CustomProducts" collection manually in your Wix site CMS.'
        );
      }
    }
  }
}

// ------------------------------------------------------------------
// Mapping helpers
// ------------------------------------------------------------------

/** Map a raw Wix Data item to our clean Product interface. */
function mapToProduct(item: any): Product {
  return {
    id: item._id,
    productName: item.productName || '',
    shortDescription: item.shortDescription || '',
    basePrice: Number(item.basePrice) || 0,
    discountPrice:
      item.discountPrice !== undefined && item.discountPrice !== null
        ? Number(item.discountPrice)
        : undefined,
    image: item.image || '',
    configurators:
      typeof item.configurators === 'string'
        ? JSON.parse(item.configurators)
        : item.configurators || [],
    status: item.status || 'Active',
    createdAt: item._createdDate || '',
    updatedAt: item._updatedDate || '',
  };
}

/** Map our Product interface to a Wix Data insert/update payload. */
function mapFromProduct(product: Partial<Product>): any {
  const result: any = { ...product };

  if (product.id) {
    result._id = product.id;
    delete result.id;
  }

  // Remove computed timestamps – Wix manages these automatically
  delete result.createdAt;
  delete result.updatedAt;

  return result;
}

// ------------------------------------------------------------------
// Web Methods (exposed to frontend)
// ------------------------------------------------------------------

export const getProducts = webMethod(
  Permissions.Anyone,
  async (searchQuery?: string, filterStatus?: string): Promise<Product[]> => {
    try {
      await ensureCollectionExists();

      let q = elevatedQuery(COLLECTION_ID);

      if (searchQuery) {
        q = q.contains('productName', searchQuery);
      }
      if (filterStatus && filterStatus !== 'All') {
        q = q.eq('status', filterStatus);
      }

      const results = await q.descending('_createdDate').find();
      return (results.items || []).map(mapToProduct);
    } catch (error) {
      console.error('Error fetching products from Wix Data:', error);
      throw new Error(
        'Failed to retrieve products. Ensure the CustomProducts collection exists.'
      );
    }
  }
);

export const getProductById = webMethod(
  Permissions.Anyone,
  async (id: string): Promise<Product> => {
    try {
      await ensureCollectionExists();
      const item = await elevatedGet(COLLECTION_ID, id);
      if (!item) {
        throw new Error(`Product with ID ${id} not found.`);
      }
      return mapToProduct(item);
    } catch (error) {
      console.error(`Error fetching product by ID ${id}:`, error);
      throw error;
    }
  }
);

export const createProduct = webMethod(
  Permissions.Anyone,
  async (
    productData: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<Product> => {
    try {
      await ensureCollectionExists();
      const dataItem = mapFromProduct(productData);
      const inserted = await elevatedInsert(COLLECTION_ID, dataItem);
      return mapToProduct(inserted);
    } catch (error) {
      console.error('Error creating product in Wix Data:', error);
      throw error;
    }
  }
);

export const updateProduct = webMethod(
  Permissions.Anyone,
  async (id: string, productData: Partial<Product>): Promise<Product> => {
    try {
      await ensureCollectionExists();
      const existing = await elevatedGet(COLLECTION_ID, id);
      if (!existing) {
        throw new Error(`Product with ID ${id} not found.`);
      }

      const updatedData = {
        ...existing,
        ...mapFromProduct(productData),
        _id: id,
      };

      const updated = await elevatedUpdate(COLLECTION_ID, updatedData);
      return mapToProduct(updated);
    } catch (error) {
      console.error(`Error updating product ID ${id} in Wix Data:`, error);
      throw error;
    }
  }
);

export const deleteProduct = webMethod(
  Permissions.Anyone,
  async (id: string): Promise<void> => {
    try {
      await ensureCollectionExists();
      await elevatedRemove(COLLECTION_ID, id);
    } catch (error) {
      console.error(`Error deleting product ID ${id} in Wix Data:`, error);
      throw error;
    }
  }
);
