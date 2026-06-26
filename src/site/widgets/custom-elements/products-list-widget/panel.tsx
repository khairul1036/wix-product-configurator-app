import React, { type FC, useState, useEffect, useCallback } from 'react';
import { widget } from '@wix/editor';
import {
  SidePanel,
  WixDesignSystemProvider,
  FormField,
  Input,
  ToggleSwitch,
  Box,
  Text,
} from '@wix/design-system';
import '@wix/design-system/styles.global.css';

const Panel: FC = () => {
  const [listTitle, setListTitle] = useState<string>('Custom Products');
  const [showSearch, setShowSearch] = useState<boolean>(true);
  const [detailsUrlPattern, setDetailsUrlPattern] = useState<string>('/customproducts/{id}');

  // Load properties from the widget
  useEffect(() => {
    Promise.all([
      widget.getProp('list-title').then((val) => val || 'Custom Products'),
      widget.getProp('show-search').then((val) => val !== 'false'),
      widget.getProp('details-url-pattern').then((val) => val || '/customproducts/{id}'),
    ])
      .then(([title, search, pattern]) => {
        setListTitle(title);
        setShowSearch(search);
        setDetailsUrlPattern(pattern);
      })
      .catch((err) => {
        console.error('Failed to load settings in products list panel:', err);
      });
  }, []);

  const handleTitleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setListTitle(val);
    widget.setProp('list-title', val);
  }, []);

  const handleSearchToggle = useCallback(() => {
    const val = !showSearch;
    setShowSearch(val);
    widget.setProp('show-search', String(val));
  }, [showSearch]);

  const handlePatternChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setDetailsUrlPattern(val);
    widget.setProp('details-url-pattern', val);
  }, []);

  return (
    <WixDesignSystemProvider>
      <SidePanel width="300" height="100vh">
        <SidePanel.Content noPadding stretchVertically>
          <Box padding="24px" direction="vertical" gap="16px">
            <Box direction="vertical" gap="4px">
              <Text weight="bold" size="medium">
                Catalog Display Settings
              </Text>
              <Text size="small" secondary>
                Configure the look of your products page.
              </Text>
            </Box>

            <FormField label="Catalog Section Title">
              <Input
                value={listTitle}
                onChange={handleTitleChange}
                placeholder="e.g. Featured Configurators"
              />
            </FormField>

            <FormField label="Details Page URL Pattern">
              <Input
                value={detailsUrlPattern}
                onChange={handlePatternChange}
                placeholder="e.g. /customproducts/{id}"
              />
            </FormField>

            <FormField label="Show Search and Sort Options">
              <ToggleSwitch
                checked={showSearch}
                onChange={handleSearchToggle}
              />
            </FormField>
          </Box>
        </SidePanel.Content>
        <SidePanel.Footer noPadding>
          <Box padding="16px" border="top">
            <Text size="tiny" secondary>
              Displays active products configured in the dashboard.
            </Text>
          </Box>
        </SidePanel.Footer>
      </SidePanel>
    </WixDesignSystemProvider>
  );
};

export default Panel;
