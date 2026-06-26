import React, { type FC, useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import reactToWebComponent from 'react-to-webcomponent';
import styles from './element.module.css';

import { getProductById } from 'backend/products.web';
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
  productId?: string;
  displayName?: string;
}

const ProductConfigurator: FC<Props> = ({ productId, displayName }) => {
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Selections state: group ID -> selected Option
  const [selections, setSelections] = useState<Record<string, Option>>({});
  
  // Custom display image override (from selected options)
  const [previewImageOverride, setPreviewImageOverride] = useState<string>('');

  // Order modal or success animation state
  const [orderComplete, setOrderComplete] = useState<boolean>(false);

  // 1. Fetch product data when productId changes
  useEffect(() => {
    if (!productId) {
      setProduct(null);
      setSelections({});
      setPreviewImageOverride('');
      return;
    }

    setLoading(true);
    setError(null);
    setOrderComplete(false);

    getProductById(productId)
      .then((data) => {
        if (!data || data.status === 'Draft') {
          setError('Selected product configuration is not active or was deleted.');
          setProduct(null);
          setLoading(false);
          return;
        }
        
        setProduct(data);
        
        // Initialize default selections to the first option of each group
        const initialSelections: Record<string, Option> = {};
        let initialPreviewOverride = '';

        if (data.configurators && data.configurators.length > 0) {
          // Sort groups & options to pick the first one deterministically
          data.configurators.forEach((group) => {
            if (group.options && group.options.length > 0) {
              const sortedOptions = [...group.options].sort((a, b) => a.order - b.order);
              const defaultOption = sortedOptions[0];
              initialSelections[group.id] = defaultOption;
              
              // If this default option has a display image, make it the default override
              if (defaultOption.displayImage && !initialPreviewOverride) {
                initialPreviewOverride = defaultOption.displayImage;
              }
            }
          });
        }

        setSelections(initialSelections);
        setPreviewImageOverride(initialPreviewOverride);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Error fetching product in custom element:', err);
        setError('Could not load the product configurator details.');
        setProduct(null);
        setLoading(false);
      });
  }, [productId]);

  // 2. Handle selection of an option inside a group
  const handleSelectOption = (groupId: string, option: Option) => {
    setSelections((prev) => ({
      ...prev,
      [groupId]: option,
    }));

    if (option.displayImage) {
      setPreviewImageOverride(option.displayImage);
    }
  };

  // 3. Format pricing
  const formatPrice = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  // 4. Compute totals
  const basePrice = product ? product.basePrice : 0;
  const discountPrice = product ? product.discountPrice : undefined;

  let totalAdjustment = 0;
  Object.values(selections).forEach((option) => {
    totalAdjustment += Number(option.priceAdjustment) || 0;
  });

  const finalBasePrice = basePrice + totalAdjustment;
  const finalDiscountPrice = discountPrice !== undefined ? discountPrice + totalAdjustment : undefined;
  const currentPrice = finalDiscountPrice !== undefined ? finalDiscountPrice : finalBasePrice;

  // Active preview image
  const activePreviewImage = previewImageOverride || (product ? product.image : '');

  // 5. Render Loading State
  if (loading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.spinner}></div>
        <p className={styles.loadingText}>Loading configurator details...</p>
      </div>
    );
  }

  // 6. Render Error State
  if (error) {
    return (
      <div className={styles.errorContainer}>
        <div className={styles.errorIcon}>⚠️</div>
        <h3 className={styles.errorTitle}>Configurator Error</h3>
        <p className={styles.errorText}>{error}</p>
      </div>
    );
  }

  // 7. Render Placeholder/Empty State (when no product is selected in Editor)
  if (!product) {
    return (
      <div className={styles.placeholderContainer}>
        <div className={styles.placeholderGrid}>
          <div className={styles.placeholderImage}>
            <div className={styles.placeholderMediaBox}>
              <div className={styles.placeholderMediaIcon}>🛍️</div>
            </div>
          </div>
          <div className={styles.placeholderInfo}>
            <h2 className={styles.placeholderTitle}>
              {displayName || 'Product Configurator'}
            </h2>
            <p className={styles.placeholderDesc}>
              This is a dynamic product customizer element. Select a custom product in the settings panel to configure options, live pricing, and media overrides.
            </p>
            <div className={styles.placeholderSkeletonList}>
              <div className={styles.skeletonItem}></div>
              <div className={styles.skeletonItem}></div>
              <div className={styles.skeletonItem}></div>
            </div>
            <div className={styles.placeholderButton}>Configure Product</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.root}>
      {orderComplete ? (
        <div className={styles.successCard}>
          <div className={styles.successIcon}>✓</div>
          <h2 className={styles.successTitle}>Configuration Confirmed!</h2>
          <p className={styles.successDesc}>
            Your customization for <strong>{product.productName}</strong> has been saved.
          </p>
          <div className={styles.successSummaryBox}>
            <h4 className={styles.summaryTitle}>Your Choices:</h4>
            <ul className={styles.summaryList}>
              {product.configurators.map((group) => {
                const selected = selections[group.id];
                return (
                  <li key={group.id} className={styles.summaryListItem}>
                    <span className={styles.summaryLabel}>{group.title}:</span>
                    <span className={styles.summaryValue}>
                      {selected ? selected.name : 'None'}
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
              <span className={styles.summaryTotalPrice}>{formatPrice(currentPrice)}</span>
            </div>
          </div>
          <button
            className={styles.resetButton}
            onClick={() => setOrderComplete(false)}
          >
            Customize Again
          </button>
        </div>
      ) : (
        <div className={styles.container}>
          {/* Left Column: Image Preview */}
          <div className={styles.previewColumn}>
            <div className={styles.imageWrapper}>
              {activePreviewImage ? (
                <img
                  src={getWixMediaUrl(activePreviewImage)}
                  alt={product.productName}
                  className={styles.productImage}
                />
              ) : (
                <div className={styles.noImagePlaceholder}>No Image Available</div>
              )}
            </div>
          </div>

          {/* Right Column: Customizer Details */}
          <div className={styles.detailsColumn}>
            <div className={styles.headerSection}>
              <h1 className={styles.productName}>{product.productName}</h1>
              <div className={styles.priceContainer}>
                {discountPrice !== undefined ? (
                  <>
                    <span className={styles.discountPrice}>{formatPrice(currentPrice)}</span>
                    <span className={styles.originalPrice}>
                      {formatPrice(basePrice + totalAdjustment)}
                    </span>
                    <span className={styles.badge}>SALE</span>
                  </>
                ) : (
                  <span className={styles.basePrice}>{formatPrice(currentPrice)}</span>
                )}
              </div>
              {product.shortDescription && (
                <p className={styles.shortDescription}>{product.shortDescription}</p>
              )}
            </div>

            <div className={styles.customizerBuilder}>
              {product.configurators.map((group) => {
                const selectedOption = selections[group.id];

                return (
                  <div key={group.id} className={styles.groupContainer}>
                    <h3 className={styles.groupTitle}>
                      {group.title}:{' '}
                      <span className={styles.activeSelectionText}>
                        {selectedOption ? selectedOption.name : ''}
                      </span>
                    </h3>
                    <div className={styles.optionsGrid}>
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
                                {isSelected && <span className={styles.swatchCheck}>✓</span>}
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
                              <span className={styles.textButtonName}>{opt.name}</span>
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

            <div className={styles.footerSection}>
              <button
                className={styles.actionButton}
                onClick={() => setOrderComplete(true)}
              >
                Confirm Configuration
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const customElement = reactToWebComponent(
  ProductConfigurator,
  React,
  ReactDOM as any,
  {
    props: {
      productId: 'string',
      displayName: 'string',
    },
  }
);

export default customElement;
