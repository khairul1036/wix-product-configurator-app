import React, { type FC, useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import reactToWebComponent from 'react-to-webcomponent';
import styles from './element.module.css';

import { createWixCheckout } from 'backend/cart.web';
import { Option } from '../../../../backend/types';

interface CartItem {
  id: string;
  productId: string;
  productName: string;
  baseImage: string;
  overlayImages: string[];
  price: number;
  quantity: number;
  selectionsText: string;
  selections: Record<string, Option>;
  customPreviewUrl?: string;
}

// Helper to convert wix:image:// URL to static HTTPS URL
function getWixMediaUrl(wixUrl: any): string {
  if (!wixUrl) return '';
  let url = typeof wixUrl === 'string' ? wixUrl : (wixUrl.src || wixUrl.url || wixUrl.fileUrl || '');
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  if (url.startsWith('wix:image://')) {
    let cleanUrl = url.startsWith('wix:image://v1/')
      ? url.substring('wix:image://v1/'.length)
      : url.substring('wix:image://'.length);
    const mediaId = cleanUrl.split('/')[0].split('#')[0];
    if (mediaId && mediaId.length > 5) return `https://static.wixstatic.com/media/${mediaId}`;
  }
  return url;
}

const CustomCartPage: FC = () => {
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [step, setStep] = useState<'cart' | 'success'>('cart');
  const [checkoutLoading, setCheckoutLoading] = useState<boolean>(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [successOrderDetails, setSuccessOrderDetails] = useState<{
    orderNumber: string;
    customerName: string;
    totalAmount: number;
  } | null>(null);

  // Load cart from localStorage on mount & check for Wix checkout success page indicators
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('custom_configurator_cart');
        if (stored) {
          setCartItems(JSON.parse(stored));
        }

        // Detect if landing on thank you page after checkout completion
        const topLoc = (window.top || window).location;
        const searchParams = new URLSearchParams(topLoc.search);
        const orderId = searchParams.get('orderId') || searchParams.get('checkoutId');

        if (topLoc.pathname.includes('/thank-you') || topLoc.pathname.includes('/order-received') || orderId) {
          setStep('success');
          // Clear cart ONLY after successful payment completion
          localStorage.removeItem('custom_configurator_cart');
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('custom-cart-updated'));
          }
          // If we have an order ID from Wix checkout, display it in success screen
          if (orderId) {
            setSuccessOrderDetails({
              orderNumber: orderId.substring(0, 10).toUpperCase(),
              customerName: searchParams.get('name') || 'Valued Customer',
              totalAmount: 0
            });
          }
        }
      } catch (e) {
        console.error('Failed to parse checkout parameters or load cart:', e);
      }
    }
  }, []);

  const formatPrice = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const cartSubtotal = cartItems.reduce((acc, item) => acc + item.price * item.quantity, 0);

  // Dispatch custom event to notify header icon
  const notifyCartUpdated = () => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('custom-cart-updated'));
    }
  };

  // Update quantity (+1 or -1) of a cart item
  const handleUpdateQty = (itemId: string, delta: number) => {
    setCartItems((prevCart) => {
      const updatedCart = prevCart
        .map((item) => {
          if (item.id === itemId) {
            const nextQty = item.quantity + delta;
            return { ...item, quantity: Math.max(1, nextQty) };
          }
          return item;
        });

      try {
        localStorage.setItem('custom_configurator_cart', JSON.stringify(updatedCart));
      } catch (e) {
        console.error('Failed to save cart to localStorage:', e);
      }

      notifyCartUpdated();
      return updatedCart;
    });
  };

  // Delete an item from the cart
  const handleDeleteCartItem = (itemId: string) => {
    setCartItems((prevCart) => {
      const updatedCart = prevCart.filter((item) => item.id !== itemId);

      try {
        localStorage.setItem('custom_configurator_cart', JSON.stringify(updatedCart));
      } catch (e) {
        console.error('Failed to save cart to localStorage:', e);
      }

      notifyCartUpdated();
      return updatedCart;
    });
  };

  // Create Wix checkout session and redirect visitor to native Wix Checkout
  const handleProceedToCheckout = async () => {
    if (cartItems.length === 0) return;

    setCheckoutLoading(true);
    setCheckoutError(null);

    try {
      const result = await createWixCheckout(cartItems);

      if (result && result.redirectUrl) {
        // DO NOT clear cart here — cart is only cleared after payment on /thank-you page
        // Redirect top window to Wix native checkout url
        if (typeof window !== 'undefined') {
          (window.top as Window).location.href = result.redirectUrl;
        }
      } else {
        throw new Error('Could not retrieve checkout redirect URL.');
      }
    } catch (err: any) {
      console.error('Wix checkout creation error:', err);
      let userFriendlyError = err.message || 'An error occurred while creating your checkout session.';
      if (
        userFriendlyError.includes('CHECKOUT_PAGE_URL_NOT_FOUND') ||
        userFriendlyError.includes('checkout page URL') ||
        userFriendlyError.includes('UNKNOWN')
      ) {
        userFriendlyError = 'Wix Native Checkout requires the "Wix Stores" (Wix E-commerce) app to be installed and active on your site. Please install "Wix Stores" from the Wix App Market in your dashboard so that Wix provisions the secure checkout page, then try again.';
      }
      setCheckoutError(userFriendlyError);
    } finally {
      setCheckoutLoading(false);
    }
  };

  // Step 1: Render Shopping Cart
  if (step === 'cart') {
    return (
      <div className={styles.root}>
        <div className={styles.cartContainer}>
          <div className={styles.mainCartArea}>
            <h1 className={styles.pageTitle}>Shopping Cart</h1>
            {cartItems.length === 0 ? (
              <div className={styles.emptyCartBox}>
                <div className={styles.emptyCartIcon}>🛒</div>
                <h3 className={styles.emptyTitle}>Your cart is empty</h3>
                <p className={styles.emptyDesc}>Choose and customize custom products to fill your cart!</p>
                <button
                  className={styles.shopBtn}
                  onClick={() => {
                    if (typeof window !== 'undefined') {
                      try {
                        (window.top as Window).location.href = '/customproducts';
                      } catch (_e) {
                        window.location.href = '/customproducts';
                      }
                    }
                  }}
                >
                  Go to Shop
                </button>
              </div>
            ) : (
              <div className={styles.cartItemList}>
                {cartItems.map((item) => (
                  <div key={item.id} className={styles.cartItemRow}>
                    <div className={styles.cartItemImgWrapper}>
                      {/* Show merged configured image if available, otherwise fallback to layer stacking */}
                      {item.customPreviewUrl ? (
                        <img src={getWixMediaUrl(item.customPreviewUrl)} alt={item.productName} className={styles.cartItemBaseImg} />
                      ) : (
                        <>
                          {item.baseImage ? (
                            <img src={item.baseImage} alt={item.productName} className={styles.cartItemBaseImg} />
                          ) : (
                            <div className={styles.noImageThumb}>🛍️</div>
                          )}
                          {item.overlayImages && item.overlayImages.map((overlayUrl, idx) => (
                            <img
                              key={idx}
                              src={overlayUrl}
                              alt=""
                              className={styles.cartItemOverlayImg}
                              style={{ zIndex: idx + 1 }}
                            />
                          ))}
                        </>
                      )}
                    </div>
                    <div className={styles.cartItemDetails}>
                      <div className={styles.cartItemHeader}>
                        <h4 className={styles.cartItemName}>{item.productName}</h4>
                        <button className={styles.deleteBtn} onClick={() => handleDeleteCartItem(item.id)}>🗑️</button>
                      </div>
                      <p className={styles.cartItemDesc}>{item.selectionsText}</p>
                      <div className={styles.cartItemControlRow}>
                        <div className={styles.quantityControls}>
                          <button className={styles.qtyBtn} onClick={() => handleUpdateQty(item.id, -1)}>-</button>
                          <span className={styles.qtyVal}>{item.quantity}</span>
                          <button className={styles.qtyBtn} onClick={() => handleUpdateQty(item.id, 1)}>+</button>
                        </div>
                        <span className={styles.cartItemPrice}>{formatPrice(item.price * item.quantity)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {cartItems.length > 0 && (
            <div className={styles.summarySidebar}>
              <h2 className={styles.sidebarTitle}>Order Summary</h2>
              <div className={styles.summaryRow}>
                <span>Subtotal:</span>
                <span>{formatPrice(cartSubtotal)}</span>
              </div>
              <div className={styles.summaryRow}>
                <span>Shipping:</span>
                <span className={styles.freeBadge}>FREE</span>
              </div>
              <div className={styles.summaryTotalRow}>
                <span>Total:</span>
                <span className={styles.totalVal}>{formatPrice(cartSubtotal)}</span>
              </div>

              {checkoutError && <div className={styles.checkoutErrorBox} style={{ marginBottom: '16px' }}>{checkoutError}</div>}

              <button
                className={styles.checkoutBtn}
                onClick={handleProceedToCheckout}
                disabled={checkoutLoading}
              >
                {checkoutLoading ? 'Redirecting to Checkout...' : 'Proceed to Checkout'}
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Step 2: Render Success (Thank You Page)
  return (
    <div className={styles.root}>
      <div className={styles.successCard}>
        <div className={styles.successIcon}>✓</div>
        <h1 className={styles.successTitle}>Order Placed Successfully!</h1>
        {successOrderDetails ? (
          <>
            <p className={styles.successDesc}>
              Thank you! Your customized order has been received and is being processed.
            </p>

            <div className={styles.successSummaryBox}>
              <h4 className={styles.summaryTitle}>Your Order Info:</h4>
              <div className={styles.summaryDetailsList}>
                <div className={styles.summaryDetailItem}>
                  <span className={styles.detailLabel}>Reference ID / Number:</span>
                  <span className={styles.detailValue}>{successOrderDetails.orderNumber}</span>
                </div>
                <div className={styles.summaryDetailItem}>
                  <span className={styles.detailLabel}>Estimated Delivery:</span>
                  <span className={styles.detailValue}>5-7 Business Days</span>
                </div>
                <div className={styles.summaryDetailItem}>
                  <span className={styles.detailLabel}>Payment Status:</span>
                  <span className={styles.statusBadge}>Paid</span>
                </div>
              </div>
            </div>
          </>
        ) : (
          <p className={styles.successDesc}>Your customized order has been submitted successfully.</p>
        )}
        <button
          className={styles.shopBtn}
          onClick={() => {
            if (typeof window !== 'undefined') {
              try {
                (window.top as Window).location.href = '/customproducts';
              } catch (_e) {
                window.location.href = '/customproducts';
              }
            }
          }}
        >
          Continue Shopping
        </button>
      </div>
    </div>
  );
};

const customElement = reactToWebComponent(
  CustomCartPage,
  React,
  ReactDOM as any,
  { props: {} }
);

export default customElement;
