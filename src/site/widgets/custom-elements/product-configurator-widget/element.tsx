import React, { type FC, useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import reactToWebComponent from 'react-to-webcomponent';
import styles from './element.module.css';

import { getProductById, getProducts } from 'backend/products.web';
import { Product, Option } from '../../../../backend/types';

// Helper to convert wix:image://v1/ or wix:image:// URL to static HTTPS URL
function getWixMediaUrl(wixUrl: any): string {
  if (!wixUrl) return '';
  
  let url = '';
  if (typeof wixUrl === 'string') {
    url = wixUrl;
  } else if (typeof wixUrl === 'object') {
    url = wixUrl.src || wixUrl.url || wixUrl.fileUrl || wixUrl.thumbnailUrl || '';
  }

  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  if (url.startsWith('wix:image://')) {
    let cleanUrl = url;
    if (url.startsWith('wix:image://v1/')) {
      cleanUrl = url.substring('wix:image://v1/'.length);
    } else {
      cleanUrl = url.substring('wix:image://'.length);
    }
    const mediaId = cleanUrl.split('/')[0].split('#')[0];
    if (mediaId && mediaId.length > 5) {
      return `https://static.wixstatic.com/media/${mediaId}`;
    }
  }
  return url;
}

interface Props {}

const ProductConfigurator: FC<Props> = () => {
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  // Track whether we are inside the Wix editor/preview iframe
  const [isEditorMode, setIsEditorMode] = useState<boolean>(false);

  // Selections state: group ID -> selected Option
  const [selections, setSelections] = useState<Record<string, Option>>({});

  // Keeps track of the selection order of group IDs for layered layout compositing
  const [selectionOrder, setSelectionOrder] = useState<string[]>([]);

  // Custom display image override (from selected options)
  const [previewImageOverride, setPreviewImageOverride] = useState<string>('');

  // Order modal or success animation state
  const [orderComplete, setOrderComplete] = useState<boolean>(false);

  // 1. Fetch product data from URL query string ?id= on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Helper: safely read a string value; returns empty string if cross-origin throws
    const safeRead = (fn: () => string): string => {
      try { return fn() || ''; } catch (_e) { return ''; }
    };

    // Helper: check if a URL looks like an iframe/editor internal URL (not a real page)
    const isInternalUrl = (href: string, hostname: string, pathname: string): boolean =>
      pathname.endsWith('.html') ||
      pathname.includes('CustomElementPreviewIframe') ||
      pathname.includes('/html/') ||
      pathname.includes('/_partials/') ||
      hostname.includes('editor.wix.com') ||
      hostname.includes('preview.wix.com') ||
      href.includes('CustomElementPreviewIframe') ||
      href.includes('static.parastorage.com') ||
      href.includes('wixstatic.com');

    // Helper: extract the product slug from the last URL path segment
    const extractSlug = (pathname: string): string => {
      const segments = pathname.split('/').filter(Boolean);
      if (segments.length === 0) return '';
      const last = segments[segments.length - 1];
      // Reject file extensions, template placeholders, and known page names
      if (
        !last ||
        last.endsWith('.html') ||
        last.endsWith('.js') ||
        last.endsWith('.css') ||
        last === '{id}' ||
        last === '%7Bid%7D' ||
        last === 'customproducts' ||
        last === 'index'
      ) return '';
      return decodeURIComponent(last);
    };

    // --- Determine context ---

    // Read own frame info
    const selfHref     = safeRead(() => window.location.href);
    const selfHostname = safeRead(() => window.location.hostname);
    const selfPathname = safeRead(() => window.location.pathname);
    const selfIsInternal = isInternalUrl(selfHref, selfHostname, selfPathname);

    // Try to read from top window (main browser tab) — safest source for path slug
    const topHref     = safeRead(() => window.top!.location.href);
    const topHostname = safeRead(() => window.top!.location.hostname);
    const topPathname = safeRead(() => window.top!.location.pathname);
    const topIsInternal = isInternalUrl(topHref, topHostname, topPathname);

    // Try parent window as secondary
    const parentPathname = safeRead(() => window.parent.location.pathname);

    // --- Resolve product slug ---

    // Priority: top window path → parent window path → own frame path
    let slug =
      (!topIsInternal ? extractSlug(topPathname) : '') ||
      extractSlug(parentPathname) ||
      (!selfIsInternal ? extractSlug(selfPathname) : '');

    // --- Handle editor / preview mode ---
    // If we are in an internal iframe AND no slug was found anywhere,
    // load the first active product as a preview so the developer can see the design pattern in Editor.
    if (selfIsInternal && !slug) {
      setIsEditorMode(true);
      setLoading(true);
      setError(null);
      getProducts(undefined, 'Active')
        .then((results) => {
          if (results && results.length > 0) {
            const previewProduct = results[0];
            setProduct(previewProduct);
            
            // Default to all options unselected initially, showing base image
            setSelections({});
            setSelectionOrder([]);
            setPreviewImageOverride('');
          } else {
            setProduct(null);
          }
          setLoading(false);
        })
        .catch((err) => {
          console.error('Failed to load preview product in editor mode:', err);
          setProduct(null);
          setLoading(false);
        });
      return;
    }

    if (!slug) {
      // On a real page but no slug in the URL — show placeholder without error
      setProduct(null);
      setSelections({});
      setPreviewImageOverride('');
      setError(null);
      setLoading(false);
      return;
    }


    setLoading(true);
    setError(null);
    setOrderComplete(false);

    getProductById(slug)
      .then((data) => {
        if (!data || data.status === 'Draft') {
          setError('Selected product configuration is not active or was deleted.');
          setProduct(null);
          setLoading(false);
          return;
        }
        
        setProduct(data);
        
        // Default to all options unselected initially, showing base image
        setSelections({});
        setSelectionOrder([]);
        setPreviewImageOverride('');
        setLoading(false);
      })
      .catch((err) => {
        console.error('Error fetching product in custom element:', err);
        setError('Could not load the product configurator details.');
        setProduct(null);
        setLoading(false);
      });
  }, []);

  // 2. Handle selection of an option inside a group (with unselect toggle and layering support)
  const handleSelectOption = (groupId: string, option: Option) => {
    const isAlreadySelected = selections[groupId]?.id === option.id;

    if (isAlreadySelected) {
      // Toggle off / Unselect
      setSelections((prev) => {
        const next = { ...prev };
        delete next[groupId];
        return next;
      });
      setSelectionOrder((prev) => prev.filter((id) => id !== groupId));
    } else {
      // Select option
      setSelections((prev) => ({
        ...prev,
        [groupId]: option,
      }));
      setSelectionOrder((prev) => {
        // Move to the end of the stack so it renders on top
        const filtered = prev.filter((id) => id !== groupId);
        return [...filtered, groupId];
      });
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

  // 7. Render Placeholder / Editor Preview State
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
              Product Configurator
            </h2>
            {isEditorMode ? (
              <p className={styles.placeholderDesc}>
                <strong>Editor Preview</strong> — This widget is working correctly.
                On the published site, it will automatically load the product whose
                "Details" button was clicked, using the <strong>?id=</strong> parameter in the URL.
                No manual configuration is needed.
              </p>
            ) : (
              <p className={styles.placeholderDesc}>
                No product found. Navigate to this page from the product list by clicking a
                product's "Details" button.
              </p>
            )}
            <div className={styles.placeholderSkeletonList}>
              <div className={styles.skeletonItem}></div>
              <div className={styles.skeletonItem}></div>
              <div className={styles.skeletonItem}></div>
            </div>
            <div className={styles.placeholderButton}>Dynamic Product Page</div>
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
              {/* 1. Base Product Image (always rendered at the bottom) */}
              {product.image ? (
                <img
                  src={getWixMediaUrl(product.image)}
                  alt={product.productName}
                  className={styles.productImage}
                />
              ) : (
                <div className={styles.noImagePlaceholder}>No Image Available</div>
              )}

              {/* 2. Layered Option Images (stacked in order of selection/clicks) */}
              {selectionOrder.map((groupId) => {
                const selectedOption = selections[groupId];
                if (selectedOption && selectedOption.displayImage) {
                  return (
                    <img
                      key={groupId}
                      src={getWixMediaUrl(selectedOption.displayImage)}
                      alt={`${product.productName} - ${selectedOption.name}`}
                      className={styles.overlayImage}
                    />
                  );
                }
                return null;
              })}
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
  { props: {} }
);

export default customElement;
