import React, { type FC, useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import reactToWebComponent from 'react-to-webcomponent';
import styles from './element.module.css';

import { getProducts } from 'backend/products.web';
import { Product } from '../../../../backend/types';

// Helper to convert wix:image://v1/ or wix:image:// URL to static HTTPS URL
function getWixMediaUrl(wixUrl: string): string {
  if (!wixUrl) return '';
  if (wixUrl.startsWith('http://') || wixUrl.startsWith('https://')) {
    return wixUrl;
  }
  if (wixUrl.startsWith('wix:image://')) {
    let cleanUrl = wixUrl;
    if (wixUrl.startsWith('wix:image://v1/')) {
      cleanUrl = wixUrl.substring('wix:image://v1/'.length);
    } else {
      cleanUrl = wixUrl.substring('wix:image://'.length);
    }
    const mediaId = cleanUrl.split('/')[0].split('#')[0];
    return `https://static.wixstatic.com/media/${mediaId}`;
  }
  return wixUrl;
}

interface Props {
  listTitle?: string;
  showSearch?: string; // custom element attributes are string
  detailsUrlPattern?: string;
}

const ProductsList: FC<Props> = ({
  listTitle = 'Featured Products',
  showSearch = 'true',
  detailsUrlPattern = '/customproducts/{id}',
}) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Search & Sorting States
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [sortOption, setSortOption] = useState<string>('default');

  // 1. Fetch all products on mount
  useEffect(() => {
    setLoading(true);
    setError(null);
    getProducts()
      .then((results) => {
        // Only display Active products
        const activeOnly = (results || []).filter((p) => p.status === 'Active');
        setProducts(activeOnly);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load products list:', err);
        setError('Failed to load the product catalog. Please try again.');
        setLoading(false);
      });
  }, []);

  // 2. Formatter helper
  const formatPrice = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  // 3. Filter & Sort products list
  const filteredProducts = products
    .filter((p) => p.productName.toLowerCase().includes(searchTerm.toLowerCase()))
    .sort((a, b) => {
      if (sortOption === 'price-low') {
        const pA = a.discountPrice !== undefined ? a.discountPrice : a.basePrice;
        const pB = b.discountPrice !== undefined ? b.discountPrice : b.basePrice;
        return pA - pB;
      }
      if (sortOption === 'price-high') {
        const pA = a.discountPrice !== undefined ? a.discountPrice : a.basePrice;
        const pB = b.discountPrice !== undefined ? b.discountPrice : b.basePrice;
        return pB - pA;
      }
      if (sortOption === 'name-asc') {
        return a.productName.localeCompare(b.productName);
      }
      return 0; // default order (creation date)
    });

  // 4. Handle Details click navigation
  const handleDetailsClick = (productId: string) => {
    let targetUrl = detailsUrlPattern;
    if (targetUrl.includes('{id}')) {
      targetUrl = targetUrl.replace('{id}', productId);
    } else {
      if (targetUrl.endsWith('/')) {
        targetUrl += productId;
      } else {
        targetUrl += '/' + productId;
      }
    }

    if (typeof window !== 'undefined') {
      window.location.href = targetUrl;
    }
  };

  return (
    <div className={styles.root}>
      {/* Catalog Title */}
      <h2 className={styles.catalogTitle}>{listTitle}</h2>

      {/* Catalog Search & Filters */}
      {showSearch === 'true' && (
        <div className={styles.filterBar}>
          <input
            type="text"
            className={styles.searchInput}
            placeholder="Search custom configurations..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <select
            className={styles.sortSelect}
            value={sortOption}
            onChange={(e) => setSortOption(e.target.value)}
          >
            <option value="default">Sort by: Default</option>
            <option value="name-asc">Sort by: Alphabetical</option>
            <option value="price-low">Sort by: Price (Low to High)</option>
            <option value="price-high">Sort by: Price (High to Low)</option>
          </select>
        </div>
      )}

      {/* Products Grid */}
      {loading ? (
        <div className={styles.loaderBox}>
          <div className={styles.spinner}></div>
          <p>Loading custom catalog...</p>
        </div>
      ) : error ? (
        <div className={styles.errorBox}>{error}</div>
      ) : filteredProducts.length === 0 ? (
        <div className={styles.emptyBox}>No products found matching your search.</div>
      ) : (
        <div className={styles.productsGrid}>
          {filteredProducts.map((p) => {
            const hasDiscount = p.discountPrice !== undefined;
            const priceToDisplay = hasDiscount ? p.discountPrice : p.basePrice;

            return (
              <div key={p.id} className={styles.productCard}>
                <div className={styles.cardImageContainer}>
                  {p.image ? (
                    <img
                      src={getWixMediaUrl(p.image)}
                      alt={p.productName}
                      className={styles.cardImage}
                    />
                  ) : (
                    <div className={styles.cardImagePlaceholder}>🛍️</div>
                  )}
                  {hasDiscount && <span className={styles.cardBadge}>SALE</span>}
                </div>
                <div className={styles.cardInfo}>
                  <h3 className={styles.cardTitle}>{p.productName}</h3>
                  <p className={styles.cardDesc} title={p.shortDescription}>
                    {p.shortDescription || 'Interactive customizable model.'}
                  </p>
                  <div className={styles.cardFooter}>
                    <div className={styles.cardPriceBox}>
                      {hasDiscount ? (
                        <>
                          <span className={styles.cardDiscountPrice}>
                            {formatPrice(priceToDisplay!)}
                          </span>
                          <span className={styles.cardOriginalPrice}>
                            {formatPrice(p.basePrice)}
                          </span>
                        </>
                      ) : (
                        <span className={styles.cardBasePrice}>
                          {formatPrice(p.basePrice)}
                        </span>
                      )}
                    </div>
                    <button
                      className={styles.detailsButton}
                      onClick={() => handleDetailsClick(p.id)}
                    >
                      Details
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

const customElement = reactToWebComponent(
  ProductsList,
  React,
  ReactDOM as any,
  {
    props: {
      listTitle: 'string',
      showSearch: 'string',
      detailsUrlPattern: 'string',
    },
  }
);

export default customElement;
