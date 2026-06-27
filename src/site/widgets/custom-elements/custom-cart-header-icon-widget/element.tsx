import React, { type FC, useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import reactToWebComponent from 'react-to-webcomponent';
import styles from './element.module.css';

interface CartItem {
  quantity: number;
}

const CustomCartHeaderIcon: FC = () => {
  const [itemCount, setItemCount] = useState<number>(0);

  const updateCartCount = () => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('custom_configurator_cart');
        if (stored) {
          const items: CartItem[] = JSON.parse(stored);
          setItemCount(items.length);
        } else {
          setItemCount(0);
        }
      } catch (e) {
        console.error('Failed to read cart storage:', e);
      }
    }
  };

  useEffect(() => {
    updateCartCount();

    // Clear cart if we just landed on the thank-you page after successful payment
    if (typeof window !== 'undefined') {
      try {
        const topLoc = (window.top || window).location;
        const searchParams = new URLSearchParams(topLoc.search);
        const orderId = searchParams.get('orderId') || searchParams.get('checkoutId');
        if (topLoc.pathname.includes('/thank-you') || topLoc.pathname.includes('/order-received') || orderId) {
          localStorage.removeItem('custom_configurator_cart');
          updateCartCount();
        }
      } catch (_e) { /* cross-origin safe */ }
    }

    // Listen to custom window events for immediate reactive updates
    if (typeof window !== 'undefined') {
      window.addEventListener('custom-cart-updated', updateCartCount);
      return () => {
        window.removeEventListener('custom-cart-updated', updateCartCount);
      };
    }
  }, []);

  const handleCartClick = () => {
    if (typeof window !== 'undefined') {
      try {
        (window.top as Window).location.href = '/cart';
      } catch (_e) {
        window.location.href = '/cart';
      }
    }
  };

  return (
    <button className={styles.cartButton} onClick={handleCartClick} title="View Cart">
      <div className={styles.iconContainer}>
        {/* Modern Shopping Bag SVG Icon */}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={styles.cartIcon}
        >
          <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
          <line x1="3" y1="6" x2="21" y2="6" />
          <path d="M16 10a4 4 0 0 1-8 0" />
        </svg>
        {itemCount > 0 && <span className={styles.cartBadge}>{itemCount}</span>}
      </div>
      <span className={styles.cartLabel}>Cart</span>
    </button>
  );
};

const customElement = reactToWebComponent(
  CustomCartHeaderIcon,
  React,
  ReactDOM as any,
  { props: {} }
);

export default customElement;
