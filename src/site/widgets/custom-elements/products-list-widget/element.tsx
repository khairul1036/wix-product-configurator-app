import React, { type FC, useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import reactToWebComponent from 'react-to-webcomponent';
import styles from './element.module.css';

import { getProducts, getProductById } from 'backend/products.web';
import { Product, Option } from '../../../../backend/types';

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
}

const ProductsList: FC<Props> = ({
  listTitle = 'Featured Products',
  showSearch = 'true',
}) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Search & Sorting States
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [sortOption, setSortOption] = useState<string>('default');

  // Modal / Customization States
  const [activeProductId, setActiveProductId] = useState<string | null>(null);
  const [activeProduct, setActiveProduct] = useState<Product | null>(null);
  const [modalLoading, setModalLoading] = useState<boolean>(false);
  const [selections, setSelections] = useState<Record<string, Option>>({});
  const [previewImageOverride, setPreviewImageOverride] = useState<string>('');
  const [orderComplete, setOrderComplete] = useState<boolean>(false);

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

  // 2. Fetch specific product details when activeProductId is set (for customization modal)
  useEffect(() => {
    if (!activeProductId) {
      setActiveProduct(null);
      setSelections({});
      setPreviewImageOverride('');
      setOrderComplete(false);
      return;
    }

    setModalLoading(true);
    getProductById(activeProductId)
      .then((data) => {
        setActiveProduct(data);
        // Initialize default selections to the first option of each group
        const initialSelections: Record<string, Option> = {};
        let initialPreviewOverride = '';

        if (data.configurators && data.configurators.length > 0) {
          data.configurators.forEach((group) => {
            if (group.options && group.options.length > 0) {
              const sorted = [...group.options].sort((a, b) => a.order - b.order);
              const defaultOption = sorted[0];
              initialSelections[group.id] = defaultOption;
              if (defaultOption.displayImage && !initialPreviewOverride) {
                initialPreviewOverride = defaultOption.displayImage;
              }
            }
          });
        }
        setSelections(initialSelections);
        setPreviewImageOverride(initialPreviewOverride);
        setModalLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load active product details:', err);
        setModalLoading(false);
      });
  }, [activeProductId]);

  // 3. Handle selection of customizer options
  const handleSelectOption = (groupId: string, option: Option) => {
    setSelections((prev) => ({
      ...prev,
      [groupId]: option,
    }));
    if (option.displayImage) {
      setPreviewImageOverride(option.displayImage);
    }
  };

  // 4. Formatter helper
  const formatPrice = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  // 5. Filter & Sort products list
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

  // 6. Compute pricing totals for selected active product
  const getModalPrices = () => {
    if (!activeProduct) return { base: 0, current: 0, original: 0, isDiscounted: false };
    const base = activeProduct.basePrice;
    const discount = activeProduct.discountPrice;

    let adjustment = 0;
    Object.values(selections).forEach((option) => {
      adjustment += Number(option.priceAdjustment) || 0;
    });

    const isDiscounted = discount !== undefined;
    const current = (isDiscounted ? discount : base) + adjustment;
    const original = base + adjustment;

    return { base, current, original, isDiscounted };
  };

  const modalPriceData = getModalPrices();

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
                      onClick={() => setActiveProductId(p.id)}
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

      {/* Inline Configuration Drawer / Modal Dialog Overlay */}
      {activeProductId && (
        <div className={styles.modalOverlay} onClick={() => setActiveProductId(null)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <button
              className={styles.closeButton}
              onClick={() => setActiveProductId(null)}
            >
              ✕
            </button>

            {modalLoading ? (
              <div className={styles.modalLoader}>
                <div className={styles.spinner}></div>
                <p>Loading customizer...</p>
              </div>
            ) : !activeProduct ? (
              <div className={styles.modalError}>Failed to retrieve product details.</div>
            ) : orderComplete ? (
              <div className={styles.successView}>
                <div className={styles.successIcon}>✓</div>
                <h3 className={styles.successTitle}>Configuration Saved!</h3>
                <p className={styles.successDesc}>
                  Your customization choices for <strong>{activeProduct.productName}</strong> have been locked in.
                </p>
                <div className={styles.summaryBox}>
                  <h4 className={styles.summaryHeading}>Your Selections:</h4>
                  <ul className={styles.summaryList}>
                    {activeProduct.configurators.map((group) => {
                      const selected = selections[group.id];
                      return (
                        <li key={group.id} className={styles.summaryItem}>
                          <span className={styles.summaryLabel}>{group.title}:</span>
                          <span className={styles.summaryVal}>
                            {selected ? selected.name : 'Default'}
                            {selected && selected.priceAdjustment !== 0 && (
                              <span className={styles.summaryAdjustment}>
                                {' '}
                                ({selected.priceAdjustment > 0 ? '+' : ''}
                                {formatPrice(selected.priceAdjustment)})
                              </span>
                            )}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                  <div className={styles.summaryTotalRow}>
                    <span>Total Price:</span>
                    <span className={styles.summaryTotalAmount}>
                      {formatPrice(modalPriceData.current)}
                    </span>
                  </div>
                </div>
                <button
                  className={styles.resetButton}
                  onClick={() => setOrderComplete(false)}
                >
                  Configure Again
                </button>
              </div>
            ) : (
              <div className={styles.customizerGrid}>
                {/* Left Column: Swapped Preview Image */}
                <div className={styles.customizerPreview}>
                  <div className={styles.modalImageWrapper}>
                    {previewImageOverride || activeProduct.image ? (
                      <img
                        src={getWixMediaUrl(previewImageOverride || activeProduct.image)}
                        alt={activeProduct.productName}
                        className={styles.modalProductImage}
                      />
                    ) : (
                      <div className={styles.modalNoImage}>No Image</div>
                    )}
                  </div>
                </div>

                {/* Right Column: Customizer Option Swatches */}
                <div className={styles.customizerOptions}>
                  <h2 className={styles.modalProductName}>{activeProduct.productName}</h2>

                  <div className={styles.modalPriceContainer}>
                    {modalPriceData.isDiscounted ? (
                      <>
                        <span className={styles.modalDiscountPrice}>
                          {formatPrice(modalPriceData.current)}
                        </span>
                        <span className={styles.modalOriginalPrice}>
                          {formatPrice(modalPriceData.original)}
                        </span>
                      </>
                    ) : (
                      <span className={styles.modalBasePrice}>
                        {formatPrice(modalPriceData.current)}
                      </span>
                    )}
                  </div>

                  {activeProduct.shortDescription && (
                    <p className={styles.modalProductDesc}>
                      {activeProduct.shortDescription}
                    </p>
                  )}

                  <div className={styles.modalOptionGroups}>
                    {activeProduct.configurators.map((group) => {
                      const selectedOption = selections[group.id];

                      return (
                        <div key={group.id} className={styles.modalGroupContainer}>
                          <h4 className={styles.modalGroupTitle}>
                            {group.title}:{' '}
                            <span className={styles.modalActiveSelectionText}>
                              {selectedOption ? selectedOption.name : ''}
                            </span>
                          </h4>
                          <div className={styles.modalOptionsGrid}>
                            {group.options
                              .sort((a, b) => a.order - b.order)
                              .map((opt) => {
                                const isSelected = selectedOption?.id === opt.id;
                                const hasChoiceImage = !!opt.choiceImage;

                                if (hasChoiceImage) {
                                  return (
                                    <button
                                      key={opt.id}
                                      className={`${styles.swatchButton} ${
                                        isSelected ? styles.swatchActive : ''
                                      }`}
                                      onClick={() => handleSelectOption(group.id, opt)}
                                      title={`${opt.name} (${
                                        opt.priceAdjustment >= 0 ? '+' : ''
                                      }${formatPrice(opt.priceAdjustment)})`}
                                    >
                                      <img
                                        src={getWixMediaUrl(opt.choiceImage)}
                                        alt={opt.name}
                                        className={styles.swatchImage}
                                      />
                                      {isSelected && (
                                        <span className={styles.swatchCheck}>✓</span>
                                      )}
                                    </button>
                                  );
                                }

                                return (
                                  <button
                                    key={opt.id}
                                    className={`${styles.textButton} ${
                                      isSelected ? styles.textActive : ''
                                    }`}
                                    onClick={() => handleSelectOption(group.id, opt)}
                                  >
                                    <span className={styles.textButtonName}>
                                      {opt.name}
                                    </span>
                                    {opt.priceAdjustment !== 0 && (
                                      <span className={styles.textButtonAdjustment}>
                                        {opt.priceAdjustment > 0 ? '+' : ''}
                                        {formatPrice(opt.priceAdjustment)}
                                      </span>
                                    )}
                                  </button>
                                );
                              })}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className={styles.modalFooter}>
                    <button
                      className={styles.modalActionButton}
                      onClick={() => setOrderComplete(true)}
                    >
                      Confirm Configuration
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
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
    },
  }
);

export default customElement;
