import { webMethod, Permissions } from '@wix/web-methods';
import { collections, items } from '@wix/data';
import { auth } from '@wix/essentials';

const COLLECTION_ID = 'CustomOrders';

const elevatedQuery = auth.elevate(items.query);
const elevatedGet = auth.elevate(items.get);
const elevatedInsert = auth.elevate(items.insert);
const elevatedGetCollection = auth.elevate(collections.getDataCollection);
const elevatedCreateCollection = auth.elevate(collections.createDataCollection);

let collectionReady = false;

async function ensureOrdersCollectionExists(): Promise<void> {
  if (collectionReady) return;

  try {
    await elevatedGetCollection(COLLECTION_ID);
    collectionReady = true;
  } catch (_checkError: any) {
    console.log('CustomOrders collection not found. Creating...');
    try {
      await elevatedCreateCollection({
        _id: COLLECTION_ID,
        displayName: 'Custom Orders',
        fields: [
          { key: 'orderNumber', displayName: 'Order Number', type: 'TEXT' },
          { key: 'customerName', displayName: 'Customer Name', type: 'TEXT' },
          { key: 'customerEmail', displayName: 'Customer Email', type: 'TEXT' },
          { key: 'customerPhone', displayName: 'Customer Phone', type: 'TEXT' },
          { key: 'customerAddress', displayName: 'Customer Address', type: 'TEXT' },
          { key: 'cartItems', displayName: 'Cart Items (JSON)', type: 'TEXT' },
          { key: 'totalAmount', displayName: 'Total Amount', type: 'NUMBER' },
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
      console.log('CustomOrders collection created successfully.');
    } catch (createError: any) {
      console.error('Failed to auto-create CustomOrders collection:', createError);
      try {
        await elevatedGetCollection(COLLECTION_ID);
        collectionReady = true;
      } catch (_finalError) {
        throw new Error('Could not find or create CustomOrders collection.');
      }
    }
  }
}

export const createCustomOrder = webMethod(
  Permissions.Anyone,
  async (
    customerDetails: {
      name: string;
      email: string;
      phone: string;
      address: string;
    },
    cartItems: any[],
    totalAmount: number
  ): Promise<{ success: boolean; orderId: string; orderNumber: string }> => {
    try {
      await ensureOrdersCollectionExists();

      const orderNumber = 'ORD-' + Math.floor(100000 + Math.random() * 900000);

      const orderItem = {
        orderNumber,
        customerName: customerDetails.name,
        customerEmail: customerDetails.email,
        customerPhone: customerDetails.phone,
        customerAddress: customerDetails.address,
        cartItems: JSON.stringify(cartItems),
        totalAmount,
        status: 'Pending',
      };

      const result = await elevatedInsert(COLLECTION_ID, orderItem);
      return {
        success: true,
        orderId: result._id,
        orderNumber: orderNumber,
      };
    } catch (error: any) {
      console.error('Error saving custom order in backend:', error);
      throw new Error(`Failed to place order: ${error.message || error}`);
    }
  }
);

// Wix native checkout imports
import { checkout } from '@wix/ecom';

const elevatedCreateCheckout = auth.elevate(checkout.createCheckout);
const elevatedGetCheckoutUrl = auth.elevate(checkout.getCheckoutUrl);

export const createWixCheckout = webMethod(
  Permissions.Anyone,
  async (cartItems: any[]): Promise<{ redirectUrl: string }> => {
    try {
      const lineItems = cartItems.map((item) => {
        // Price must be string according to Velo customLineItems schema
        const priceStr = String(item.price);
        
        return {
          productName: { original: `${item.productName} (${item.selectionsText})` },
          quantity: item.quantity,
          price: priceStr,
          itemType: { preset: 'PHYSICAL' }
        };
      });

      const options = {
        channelType: 'WEB',
        customLineItems: lineItems
      };

      const checkoutResult = await elevatedCreateCheckout(options as any);
      const checkoutId = checkoutResult._id;
      
      if (!checkoutId) {
        throw new Error('Checkout session was created but returned no ID.');
      }
      
      const urlResponse = await elevatedGetCheckoutUrl(checkoutId);
      return { redirectUrl: urlResponse.checkoutUrl || '' };
    } catch (error: any) {
      console.error('Error creating Wix checkout backend:', error);
      throw new Error(`Failed to initialize checkout: ${error.message || error}`);
    }
  }
);

