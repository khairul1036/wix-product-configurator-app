import { webMethod, Permissions } from '@wix/web-methods';
import { collections, items } from '@wix/data';
import { auth, httpClient } from '@wix/essentials';
import { Buffer } from 'buffer';

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

// WebMethod to upload base64 merged custom product image to Wix Media Manager
export const uploadConfiguredImage = webMethod(
  Permissions.Anyone,
  async (base64Data: string, filename: string): Promise<{ fileUrl: string }> => {
    try {
      // 1. Generate the upload URL from Wix
      const generateResponse = await httpClient.fetchWithAuth(
        'https://www.wixapis.com/site-media/v1/files/generate-upload-url',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            mimeType: 'image/jpeg',
            fileName: filename
          }),
        }
      );

      if (!generateResponse.ok) {
        const errText = await generateResponse.text();
        throw new Error(`Failed to generate upload URL: ${errText}`);
      }

      const generateResult = await generateResponse.json();
      const uploadUrl = generateResult.uploadUrl;
      if (!uploadUrl) {
        throw new Error('No uploadUrl returned from Wix Media API.');
      }

      // 2. Prepare raw binary buffer from base64
      const strippedData = base64Data.replace(/^data:image\/\w+;base64,/, '');
      const buffer = Buffer.from(strippedData, 'base64');

      // 3. Upload raw binary to uploadUrl using standard fetch
      const uploadResponse = await fetch(uploadUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': 'image/jpeg',
        },
        body: buffer,
      });

      if (!uploadResponse.ok) {
        const errText = await uploadResponse.text();
        throw new Error(`Failed to upload binary: ${errText}`);
      }

      const responseText = await uploadResponse.text();
      console.log('Upload response:', responseText);

      let fileUrl = '';
      try {
        const responseData = JSON.parse(responseText);
        // The PUT upload response is an array or an object containing file details
        const fileObj = Array.isArray(responseData) ? responseData[0] : (responseData.file || responseData);
        fileUrl = fileObj.fileUrl || fileObj.url || fileObj.fileUri || '';
      } catch (e) {
        console.error('Failed to parse upload response JSON:', e);
      }

      return { fileUrl };
    } catch (error: any) {
      console.error('Error uploading customized product image:', error);
      throw new Error(`Failed to upload customized image: ${error.message || error}`);
    }
  }
);

// Wix native checkout imports
import { checkout } from '@wix/ecom';

const elevatedCreateCheckout = auth.elevate(checkout.createCheckout);
const elevatedGetCheckoutUrl = auth.elevate(checkout.getCheckoutUrl);

// Helper to convert HTTP Wix media URLs to wix:image Velo format
function parseToWixMediaUrl(url: string): string {
  if (!url) return '';
  if (url.startsWith('wix:image://')) return url;

  try {
    if (url.includes('/media/')) {
      const parts = url.split('/media/');
      const mediaPart = parts[1].split('/')[0];
      return `wix:image://v1/${mediaPart}/${mediaPart}#originWidth=800&originHeight=800`;
    }
  } catch (e) {
    console.error('Error parsing image URL to Wix media URL:', e);
  }
  return url;
}

export const createWixCheckout = webMethod(
  Permissions.Anyone,
  async (cartItems: any[]): Promise<{ redirectUrl: string }> => {
    try {
      const lineItems = cartItems.map((item) => {
        // Price must be string according to Velo customLineItems schema
        const priceStr = String(item.price);

        let mediaUrl = '';
        if (item.customPreviewUrl) {
          mediaUrl = parseToWixMediaUrl(item.customPreviewUrl);
        } else if (item.baseImage) {
          mediaUrl = parseToWixMediaUrl(item.baseImage);
        }

        return {
          productName: { original: `${item.productName} (${item.selectionsText})` },
          quantity: item.quantity,
          price: priceStr,
          itemType: { preset: 'PHYSICAL' },
          ...(mediaUrl ? { media: mediaUrl } : {})
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
      const errMsg = error.message || String(error);
      if (errMsg.includes('CHECKOUT_PAGE_URL_NOT_FOUND') || errMsg.includes('checkout page URL')) {
        throw new Error('Wix Stores (Wix E-commerce) app is not installed or active on this site. Please add the "Wix Stores" app from the Wix App Market in your dashboard to enable the secure checkout page.');
      }
      throw new Error(`Failed to initialize checkout: ${errMsg}`);
    }
  }
);

