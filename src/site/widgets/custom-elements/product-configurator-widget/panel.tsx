import React, { type FC } from 'react';
import {
  SidePanel,
  WixDesignSystemProvider,
  Box,
  Text,
  SectionHelper,
} from '@wix/design-system';
import '@wix/design-system/styles.global.css';

const Panel: FC = () => {
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
                This widget automatically loads the product from the dynamic page URL.
              </Text>
            </Box>

            <SectionHelper appearance="success" fullWidth>
              <Box direction="vertical" gap="8px">
                <Text size="small" weight="bold">How It Works</Text>
                <Text size="small">
                  When a visitor clicks "Details" on the products list, they are taken to this
                  dynamic page with the product ID in the URL (e.g. <strong>?id=...</strong>).
                  This widget reads the ID automatically and displays the correct product — no
                  manual selection required.
                </Text>
              </Box>
            </SectionHelper>

            <SectionHelper appearance="standard" fullWidth>
              <Box direction="vertical" gap="6px">
                <Text size="small" weight="bold">Setup Checklist</Text>
                <Text size="small">✅ Place this widget on your dynamic product details page.</Text>
                <Text size="small">✅ Make sure the "All Products List Widget" links to this page.</Text>
                <Text size="small">✅ Publish your site for the full flow to work.</Text>
              </Box>
            </SectionHelper>
          </Box>
        </SidePanel.Content>
        <SidePanel.Footer noPadding>
          <Box padding="16px" border="top">
            <Text size="tiny" secondary>
              Products are managed in the site dashboard.
            </Text>
          </Box>
        </SidePanel.Footer>
      </SidePanel>
    </WixDesignSystemProvider>
  );
};

export default Panel;
