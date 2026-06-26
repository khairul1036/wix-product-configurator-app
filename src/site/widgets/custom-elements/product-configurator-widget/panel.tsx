import React, { type FC, useState, useEffect, useCallback } from 'react';
import { widget } from '@wix/editor';
import {
  SidePanel,
  WixDesignSystemProvider,
  FormField,
  Dropdown,
  Loader,
  Box,
  Text,
  SectionHelper,
} from '@wix/design-system';
import '@wix/design-system/styles.global.css';

import { getProducts } from 'backend/products.web';
import { Product } from '../../../../backend/types';

const Panel: FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<boolean>(false);

  // 1. Fetch products from CMS on load
  useEffect(() => {
    getProducts()
      .then((results) => {
        // We only want to configure Active products
        const activeProducts = (results || []).filter((p) => p.status === 'Active');
        setProducts(activeProducts);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load products for settings panel:', err);
        setError(true);
        setLoading(false);
      });
  }, []);

  // 2. Fetch current property value from the widget
  useEffect(() => {
    widget.getProp('product-id')
      .then((val) => {
        if (val) {
          setSelectedProductId(val);
        }
      })
      .catch((err) => {
        console.error('Failed to read product-id property:', err);
      });
  }, []);

  // 3. Handle product selection change
  const handleProductSelect = useCallback(
    (option: any) => {
      const val = option.id as string;
      setSelectedProductId(val);
      widget.setProp('product-id', val);

      // Save name as a fallback displayName property
      const prod = products.find((p) => p.id === val);
      if (prod) {
        widget.setProp('display-name', prod.productName);
      }
    },
    [products]
  );

  const dropdownOptions = products.map((p) => ({
    id: p.id,
    value: p.productName,
  }));

  const selectedOption = dropdownOptions.find((o) => o.id === selectedProductId);

  return (
    <WixDesignSystemProvider>
      <SidePanel width="300" height="100vh">
        <SidePanel.Content noPadding stretchVertically>
          <Box padding="24px" direction="vertical" gap="16px">
            <Box direction="vertical" gap="4px">
              <Text weight="bold" size="medium">
                Product Configurator
              </Text>
              <Text size="small" secondary>
                Select which custom product configurator to display on this page.
              </Text>
            </Box>

            {loading ? (
              <Box align="center" verticalAlign="middle" padding="40px">
                <Loader size="medium" />
              </Box>
            ) : error ? (
              <SectionHelper appearance="danger" fullWidth>
                Failed to load products. Please refresh or try again.
              </SectionHelper>
            ) : products.length === 0 ? (
              <SectionHelper appearance="warning" fullWidth>
                No active custom products found. Please create and publish some products in your dashboard first.
              </SectionHelper>
            ) : (
              <FormField label="Select Product" required>
                <Dropdown
                  options={dropdownOptions}
                  selectedId={selectedProductId}
                  onSelect={handleProductSelect}
                  placeholder="Choose a custom product"
                />
              </FormField>
            )}

            {selectedOption && (
              <Box direction="vertical" gap="8px" marginTop="16px">
                <Text size="small" weight="bold">
                  Active Configuration
                </Text>
                <Box
                  padding="12px"
                  backgroundColor="D60"
                  borderRadius="8px"
                  border="1px solid D40"
                >
                  <Text size="small">
                    <strong>Product:</strong> {selectedOption.value}
                  </Text>
                </Box>
              </Box>
            )}
          </Box>
        </SidePanel.Content>
        <SidePanel.Footer noPadding>
          <Box padding="16px" border="top">
            <Text size="tiny" secondary>
              Custom products are managed inside the site dashboard.
            </Text>
          </Box>
        </SidePanel.Footer>
      </SidePanel>
    </WixDesignSystemProvider>
  );
};

export default Panel;
