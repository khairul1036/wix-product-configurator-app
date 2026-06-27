import React, { type FC, useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import reactToWebComponent from 'react-to-webcomponent';
import styles from './element.module.css';

import { createCustomOrder } from 'backend/cart.web';
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
}

const CustomCartPage: FC = () => {
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [step, setStep] = useState<'cart' | 'checkout' | 'success'>('cart');
  const [checkoutForm, setCheckoutForm] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
  });
  const [submittingOrder, setSubmittingOrder] = useState<boolean>(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [successOrderDetails, setSuccessOrderDetails] = useState<{
    orderNumber: string;
    customerName: string;
    totalAmount: number;
  } | null>(null);

  // Load cart from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('custom_configurator_cart');
        if (stored) {
          setCartItems(JSON.parse(stored));
        }
      } catch (e) {
        console.error('Failed to load cart from localStorage:', e);
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

  // Submit custom checkout form and save order in backend database CMS
  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cartItems.length === 0) return;

    setSubmittingOrder(true);
    setCheckoutError(null);

    try {
      // 1. Call backend web method to insert the order details to the CMS
      const result = await createCustomOrder(checkoutForm, cartItems, cartSubtotal);

      if (result.success) {
        // 2. Set success details
        setSuccessOrderDetails({
          orderNumber: result.orderNumber,
          customerName: checkoutForm.name,
          totalAmount: cartSubtotal,
        });

        // 3. Reset local checkout states & clear cart
        setCartItems([]);
        localStorage.removeItem('custom_configurator_cart');
        notifyCartUpdated();
        setStep('success');
      } else {
        throw new Error('Failed to save your order. Please try again.');
      }
    } catch (err: any) {
      console.error('Checkout error:', err);
      setCheckoutError(err.message || 'An error occurred while processing your order.');
    } finally {
      setSubmittingOrder(false);
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
                      {/* Base Image */}
                      {item.baseImage ? (
                        <img src={item.baseImage} alt={item.productName} className={styles.cartItemBaseImg} />
                      ) : (
                        <div className={styles.noImageThumb}>🛍️</div>
                      )}
                      {/* Stacked Configurator Overlays */}
                      {item.overlayImages && item.overlayImages.map((overlayUrl, idx) => (
                        <img
                          key={idx}
                          src={overlayUrl}
                          alt=""
                          className={styles.cartItemOverlayImg}
                          style={{ zIndex: idx + 1 }}
                        />
                      ))}
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
              <button className={styles.checkoutBtn} onClick={() => setStep('checkout')}>
                Proceed to Checkout
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Step 2: Render Checkout
  if (step === 'checkout') {
    return (
      <div className={styles.root}>
        <div className={styles.checkoutContainer}>
          <div className={styles.checkoutMain}>
            <div className={styles.backRow}>
              <button className={styles.backBtn} onClick={() => setStep('cart')}>
                ← Back to Cart
              </button>
            </div>
            <h1 className={styles.pageTitle}>Shipping & Payment</h1>
            
            <form className={styles.checkoutForm} onSubmit={handlePlaceOrder}>
              <h3 className={styles.formSectionTitle}>Shipping Address</h3>
              
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Full Name</label>
                <input
                  type="text"
                  className={styles.formInput}
                  required
                  value={checkoutForm.name}
                  onChange={(e) => setCheckoutForm({ ...checkoutForm, name: e.target.value })}
                />
              </div>

              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Email Address</label>
                  <input
                    type="email"
                    className={styles.formInput}
                    required
                    value={checkoutForm.email}
                    onChange={(e) => setCheckoutForm({ ...checkoutForm, email: e.target.value })}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Phone Number</label>
                  <input
                    type="tel"
                    className={styles.formInput}
                    required
                    value={checkoutForm.phone}
                    onChange={(e) => setCheckoutForm({ ...checkoutForm, phone: e.target.value })}
                  />
                </div>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Full Shipping Address</label>
                <textarea
                  className={styles.formTextarea}
                  rows={3}
                  required
                  value={checkoutForm.address}
                  onChange={(e) => setCheckoutForm({ ...checkoutForm, address: e.target.value })}
                />
              </div>

              <h3 className={styles.formSectionTitle}>Payment Details (Demo Mock)</h3>
              <div className={styles.mockCardBox}>
                <span className={styles.mockCardIcon}>💳</span>
                <span className={styles.mockCardText}>Mock Credit Card (Auto-Approved on confirmation)</span>
              </div>

              {checkoutError && <div className={styles.checkoutErrorBox}>{checkoutError}</div>}
              
              <button type="submit" className={styles.placeOrderBtn} disabled={submittingOrder}>
                {submittingOrder ? 'Placing Order...' : `Pay & Confirm Order (${formatPrice(cartSubtotal)})`}
              </button>
            </form>
          </div>

          <div className={styles.checkoutSidebar}>
            <h2 className={styles.sidebarTitle}>Summary</h2>
            <div className={styles.summaryCartItems}>
              {cartItems.map((item) => (
                <div key={item.id} className={styles.summaryCartItemRow}>
                  <div className={styles.summaryItemThumbWrapper}>
                    {/* Base Image */}
                    {item.baseImage ? (
                      <img src={item.baseImage} alt={item.productName} className={styles.summaryItemBaseThumb} />
                    ) : (
                      <div className={styles.noImageThumb}>🛍️</div>
                    )}
                    {/* Stacked Configurator Overlays */}
                    {item.overlayImages && item.overlayImages.map((overlayUrl, idx) => (
                      <img
                        key={idx}
                        src={overlayUrl}
                        alt=""
                        className={styles.summaryItemOverlayThumb}
                        style={{ zIndex: idx + 1 }}
                      />
                    ))}
                  </div>
                  <div className={styles.summaryItemDetails}>
                    <h5 className={styles.summaryItemName}>{item.productName} x{item.quantity}</h5>
                    <span className={styles.summaryItemPrice}>{formatPrice(item.price * item.quantity)}</span>
                  </div>
                </div>
              ))}
            </div>
            <div className={styles.summaryRow}>
              <span>Subtotal:</span>
              <span>{formatPrice(cartSubtotal)}</span>
            </div>
            <div className={styles.summaryRow}>
              <span>Shipping:</span>
              <span className={styles.freeBadge}>FREE</span>
            </div>
            <div className={styles.summaryTotalRow}>
              <span>Total Amount:</span>
              <span className={styles.totalVal}>{formatPrice(cartSubtotal)}</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Step 3: Render Success (Thank You Page)
  return (
    <div className={styles.root}>
      <div className={styles.successCard}>
        <div className={styles.successIcon}>✓</div>
        <h1 className={styles.successTitle}>Order Placed Successfully!</h1>
        {successOrderDetails ? (
          <>
            <p className={styles.successDesc}>
              Thank you <strong>{successOrderDetails.customerName}</strong>! Your customized order has been received and is being prepared.
            </p>
            
            <div className={styles.successSummaryBox}>
              <h4 className={styles.summaryTitle}>Your Order Info:</h4>
              <div className={styles.summaryDetailsList}>
                <div className={styles.summaryDetailItem}>
                  <span className={styles.detailLabel}>Order Number:</span>
                  <span className={styles.detailValue}>{successOrderDetails.orderNumber}</span>
                </div>
                <div className={styles.summaryDetailItem}>
                  <span className={styles.detailLabel}>Total Amount:</span>
                  <span className={styles.detailValueHighlight}>{formatPrice(successOrderDetails.totalAmount)}</span>
                </div>
                <div className={styles.summaryDetailItem}>
                  <span className={styles.detailLabel}>Estimated Delivery:</span>
                  <span className={styles.detailValue}>5-7 Business Days</span>
                </div>
                <div className={styles.summaryDetailItem}>
                  <span className={styles.detailLabel}>Order Status:</span>
                  <span className={styles.statusBadge}>Processing</span>
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
