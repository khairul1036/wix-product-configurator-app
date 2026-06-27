import React, { type FC, useState, useEffect } from 'react';
import { dashboard } from '@wix/dashboard';
import {
  WixDesignSystemProvider,
  Page,
  FormField,
  Input,
  InputArea,
  Button,
  Box,
  Text,
  Heading,
  Card,
  IconButton,
  Loader,
  Image,
} from '@wix/design-system';
import '@wix/design-system/styles.global.css';
import * as Icons from '@wix/wix-ui-icons-common';

import { getProductById, createProduct, updateProduct } from 'backend/products.web';
import { Product, Configurator, Option } from 'backend/types';

// Helper: Convert Wix Media URLs (wix:image://v1/...) to renderable HTTP URLs
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

const generateId = () => '_' + Math.random().toString(36).substring(2, 11);

interface EditorProps {
  productId: string | null;
  onClose: () => void;
}

const Editor: FC<EditorProps> = ({ productId, onClose }) => {
  // Navigation & Mode States
  const [loading, setLoading] = useState<boolean>(false);

  // Form State
  const [productName, setProductName] = useState<string>('');
  const [shortDescription, setShortDescription] = useState<string>('');
  const [basePrice, setBasePrice] = useState<string>('');
  const [discountPrice, setDiscountPrice] = useState<string>('');
  const [imageUrl, setImageUrl] = useState<string>('');
  const [configurators, setConfigurators] = useState<Configurator[]>([]);
  const [status, setStatus] = useState<'Active' | 'Draft'>('Active');

  // Validation States
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  // 1. Load product if editing
  useEffect(() => {
    if (productId) {
      loadProduct(productId);
    }
  }, [productId]);

  const loadProduct = async (id: string) => {
    setLoading(true);
    try {
      const prod = await getProductById(id);
      setProductName(prod.productName);
      setShortDescription(prod.shortDescription);
      setBasePrice(prod.basePrice.toString());
      setDiscountPrice(prod.discountPrice ? prod.discountPrice.toString() : '');
      setImageUrl(prod.image);
      setConfigurators(prod.configurators || []);
      setStatus(prod.status || 'Active');
    } catch (err: any) {
      console.error('Error loading product details:', err);
      dashboard.showToast({
        message: 'Failed to load product details.',
        type: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  // 2. Image Selection via Wix Media Manager (runs smoothly on page frame)
  const handleSelectImage = async () => {
    try {
      const result = await dashboard.openMediaManager({
        multiSelect: false,
        category: 'IMAGE',
      });

      if (result && result.items && result.items.length > 0) {
        const selectedItem = result.items[0] as any;
        const mediaUrl =
          selectedItem.url ||
          selectedItem.fileUrl ||
          selectedItem.thumbnailUrl ||
          '';

        if (mediaUrl) {
          setImageUrl(mediaUrl);
          setErrors((prev) => ({ ...prev, image: '' }));
        }
      }
    } catch (err: any) {
      console.log('Media Manager closed/error:', err?.message || err);
    }
  };

  const handleRemoveImage = () => {
    setImageUrl('');
  };

  // 3. Dynamic Configurator Groups operations
  const handleAddGroup = () => {
    const newGroup: Configurator = {
      id: generateId(),
      title: 'New Configurator Group',
      options: [],
    };
    setConfigurators((prev) => [...prev, newGroup]);
  };

  const handleRemoveGroup = (groupId: string) => {
    setConfigurators((prev) => prev.filter((g) => g.id !== groupId));
  };

  const handleRenameGroup = (groupId: string, newTitle: string) => {
    setConfigurators((prev) =>
      prev.map((g) => (g.id === groupId ? { ...g, title: newTitle } : g))
    );
  };

  const handleMoveGroup = (index: number, direction: 'up' | 'down') => {
    const newConfigurators = [...configurators];
    if (direction === 'up' && index > 0) {
      [newConfigurators[index], newConfigurators[index - 1]] = [newConfigurators[index - 1], newConfigurators[index]];
    } else if (direction === 'down' && index < configurators.length - 1) {
      [newConfigurators[index], newConfigurators[index + 1]] = [newConfigurators[index + 1], newConfigurators[index]];
    }
    setConfigurators(newConfigurators);
  };

  // 4. Dynamic Options operations inside a group
  const handleAddOption = (groupId: string) => {
    setConfigurators((prev) =>
      prev.map((g) => {
        if (g.id !== groupId) return g;
        const newOption: Option = {
          id: generateId(),
          name: 'Option Name',
          type: 'Color',
          choiceImage: '',
          displayImage: '',
          priceAdjustment: 0,
          order: g.options.length + 1,
        };
        return { ...g, options: [...g.options, newOption] };
      })
    );
  };

  const handleRemoveOption = (groupId: string, optionId: string) => {
    setConfigurators((prev) =>
      prev.map((g) => {
        if (g.id !== groupId) return g;
        return {
          ...g,
          options: g.options.filter((o: Option) => o.id !== optionId),
        };
      })
    );
  };

  const handleUpdateOption = (
    groupId: string,
    optionId: string,
    field: keyof Option,
    value: any
  ) => {
    setConfigurators((prev) =>
      prev.map((g) => {
        if (g.id !== groupId) return g;
        return {
          ...g,
          options: g.options.map((o: Option) =>
            o.id === optionId ? { ...o, [field]: value } : o
          ),
        };
      })
    );
  };

  const handleSelectOptionImage = async (
    groupId: string,
    optionId: string,
    field: 'choiceImage' | 'displayImage'
  ) => {
    try {
      const result = await dashboard.openMediaManager({
        multiSelect: false,
        category: 'IMAGE',
      });

      if (result && result.items && result.items.length > 0) {
        const selectedItem = result.items[0] as any;
        const mediaUrl =
          selectedItem.url ||
          selectedItem.fileUrl ||
          selectedItem.thumbnailUrl ||
          '';

        if (mediaUrl) {
          handleUpdateOption(groupId, optionId, field, mediaUrl);
        }
      }
    } catch (err: any) {
      console.log('Option image selection closed/error:', err?.message || err);
    }
  };

  const handleMoveOption = (
    groupId: string,
    index: number,
    direction: 'up' | 'down'
  ) => {
    setConfigurators((prev) =>
      prev.map((g) => {
        if (g.id !== groupId) return g;
        const newOptions = [...g.options];
        if (direction === 'up' && index > 0) {
          [newOptions[index], newOptions[index - 1]] = [newOptions[index - 1], newOptions[index]];
        } else if (direction === 'down' && index < newOptions.length - 1) {
          [newOptions[index], newOptions[index + 1]] = [newOptions[index + 1], newOptions[index]];
        }
        const updated = newOptions.map((opt, idx) => ({ ...opt, order: idx + 1 }));
        return { ...g, options: updated };
      })
    );
  };

  // 5. Validation logic
  const validateForm = (): boolean => {
    const tempErrors: { [key: string]: string } = {};
    if (!productName.trim()) {
      tempErrors.name = 'Product Name is required';
    }
    if (!basePrice.trim() || isNaN(Number(basePrice)) || Number(basePrice) < 0) {
      tempErrors.basePrice = 'Valid base price is required';
    }
    if (discountPrice.trim() && (isNaN(Number(discountPrice)) || Number(discountPrice) < 0)) {
      tempErrors.discountPrice = 'Discount price must be a positive number';
    }
    if (discountPrice.trim() && Number(discountPrice) >= Number(basePrice)) {
      tempErrors.discountPrice = 'Discount price must be lower than base price';
    }

    setErrors(tempErrors);
    return Object.keys(tempErrors).length === 0;
  };

  // 6. Submit logic
  const handleSave = async () => {
    if (!validateForm()) {
      dashboard.showToast({
        message: 'Please resolve form validation errors.',
        type: 'error',
      });
      return;
    }

    setLoading(true);
    const data = {
      productName,
      shortDescription,
      basePrice: Number(basePrice),
      discountPrice: discountPrice.trim() ? Number(discountPrice) : undefined,
      image: imageUrl,
      configurators,
      status,
    };

    try {
      if (productId) {
        await updateProduct(productId, data);
        dashboard.showToast({
          message: 'Product updated successfully!',
          type: 'success',
        });
      } else {
        await createProduct(data);
        dashboard.showToast({
          message: 'Product created successfully!',
          type: 'success',
        });
      }
      onClose();
    } catch (err: any) {
      console.error('Error saving product:', err);
      dashboard.showToast({
        message: 'Failed to save product details.',
        type: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading && productName === '') {
    return (
      <WixDesignSystemProvider>
        <Box height="500px" align="center" verticalAlign="middle" direction="vertical">
          <Loader size="large" />
          <Box marginTop="12px">
            <Text>Loading product editor...</Text>
          </Box>
        </Box>
      </WixDesignSystemProvider>
    );
  }

  return (
    <WixDesignSystemProvider>
      <Page>
        <Page.Header
          title={productId ? 'Edit Product Details' : 'Add Custom Product'}
          subtitle="Manage product description, price, and dynamic configurator options."
          actionsBar={
            <Box gap="8px">
              <Button priority="secondary" onClick={onClose} disabled={loading}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={loading}>
                {loading ? 'Saving...' : 'Save Product'}
              </Button>
            </Box>
          }
        />
        <Page.Content>
          <Box direction="vertical" gap="24px" width="100%">
            {/* 1. Basic Information Section */}
            <Card>
              <Card.Header title="Basic Information" />
              <Card.Content>
                <Box direction="horizontal" gap="16px" width="100%">
                  <Box direction="vertical" width="60%" gap="16px">
                    <FormField label="Product Name" required status={errors.name ? 'error' : undefined} statusMessage={errors.name}>
                      <Input
                        value={productName}
                        placeholder="e.g. Ergonomic Office Desk"
                        onChange={(e) => {
                          setProductName(e.target.value);
                          if (errors.name) setErrors((prev) => ({ ...prev, name: '' }));
                        }}
                      />
                    </FormField>

                    <FormField label="Short Description">
                      <InputArea
                        value={shortDescription}
                        placeholder="Provide a brief explanation of the product characteristics..."
                        rows={3}
                        onChange={(e) => setShortDescription(e.target.value)}
                      />
                    </FormField>

                    <Box gap="16px" direction="horizontal" width="100%">
                      <Box width="50%">
                        <FormField label="Base Price" required status={errors.basePrice ? 'error' : undefined} statusMessage={errors.basePrice}>
                          <Input
                            prefix={<Text>$</Text>}
                            type="number"
                            value={basePrice}
                            placeholder="0.00"
                            onChange={(e) => {
                              setBasePrice(e.target.value);
                              if (errors.basePrice) setErrors((prev) => ({ ...prev, basePrice: '' }));
                            }}
                          />
                        </FormField>
                      </Box>
                      <Box width="50%">
                        <FormField label="Discount Price" status={errors.discountPrice ? 'error' : undefined} statusMessage={errors.discountPrice}>
                          <Input
                            prefix={<Text>$</Text>}
                            type="number"
                            value={discountPrice}
                            placeholder="Optional"
                            onChange={(e) => {
                              setDiscountPrice(e.target.value);
                              if (errors.discountPrice) setErrors((prev) => ({ ...prev, discountPrice: '' }));
                            }}
                          />
                        </FormField>
                      </Box>
                    </Box>

                    <FormField label="Status">
                      <Box gap="16px" direction="horizontal">
                        <Button
                          priority={status === 'Active' ? 'primary' : 'secondary'}
                          skin={status === 'Active' ? 'standard' : 'light'}
                          onClick={() => setStatus('Active')}
                          size="small"
                        >
                          Active
                        </Button>
                        <Button
                          priority={status === 'Draft' ? 'primary' : 'secondary'}
                          skin={status === 'Draft' ? 'standard' : 'light'}
                          onClick={() => setStatus('Draft')}
                          size="small"
                        >
                          Draft
                        </Button>
                      </Box>
                    </FormField>
                  </Box>

                  <Box direction="vertical" width="40%" gap="8px" align="center" verticalAlign="middle" style={{ borderLeft: '1px solid #DFE5EB', paddingLeft: '24px' }}>
                    <Text weight="bold">Product Image</Text>
                    <FormField status={errors.image ? 'error' : undefined} statusMessage={errors.image}>
                      {imageUrl ? (
                        <Box direction="vertical" align="center" gap="8px">
                          <div style={{ cursor: 'pointer' }} onClick={handleSelectImage}>
                            <Image
                              src={getWixMediaUrl(imageUrl)}
                              width="180px"
                              height="180px"
                              fit="contain"
                              style={{ border: '1px solid #DFE5EB', borderRadius: '8px', padding: '8px', backgroundColor: '#F8F9FA' }}
                            />
                          </div>
                          <Box gap="8px">
                            <Button size="tiny" skin="light" prefixIcon={<Icons.Upload />} onClick={handleSelectImage}>
                              Change
                            </Button>
                            <Button size="tiny" skin="destructive" onClick={handleRemoveImage}>
                              Remove
                            </Button>
                          </Box>
                        </Box>
                      ) : (
                        <div style={{ cursor: 'pointer' }} onClick={handleSelectImage}>
                          <Box
                            direction="vertical"
                            align="center"
                            verticalAlign="middle"
                            height="180px"
                            width="180px"
                            style={{
                              border: errors.image ? '2px dashed #D6453D' : '2px dashed #DFE5EB',
                              borderRadius: '8px',
                              backgroundColor: '#F8F9FA',
                            }}
                          >
                            <Icons.Upload size="36px" style={{ color: '#A0AAB2', marginBottom: '8px' }} />
                            <Text size="small" secondary>Choose from Media</Text>
                          </Box>
                        </div>
                      )}
                    </FormField>
                  </Box>
                </Box>
              </Card.Content>
            </Card>

            {/* 2. Configurator Builder Section */}
            <Box direction="vertical" gap="16px" width="100%">
              <Box align="space-between" verticalAlign="middle">
                <Heading as="h4">Dynamic Configurator Groups</Heading>
                <Button size="small" prefixIcon={<Icons.Add />} onClick={handleAddGroup}>
                  Add Configurator Group
                </Button>
              </Box>

              {configurators.length === 0 ? (
                <Card>
                  <Card.Content>
                    <Box height="180px" align="center" verticalAlign="middle" direction="vertical">
                      <Text secondary>No configurator groups have been added yet.</Text>
                      <Text size="small" secondary marginTop="4px">
                        Create groups like Size, Color, or Material to offer custom configurations.
                      </Text>
                      <Button size="small" style={{ marginTop: '12px' }} prefixIcon={<Icons.Add />} onClick={handleAddGroup}>
                        Create First Group
                      </Button>
                    </Box>
                  </Card.Content>
                </Card>
              ) : (
                <Box direction="vertical" gap="16px" style={{ overflowY: 'auto', maxHeight: '420px', paddingRight: '8px' }}>
                  {configurators.map((group, groupIdx) => (
                    <Card key={group.id}>
                      <Card.Header
                        title={
                          <Box gap="12px" align="left" verticalAlign="middle" width="100%">
                            <Box width="250px">
                              <Input
                                value={group.title}
                                placeholder="Group Name (e.g. Color, Size)"
                                onChange={(e) => handleRenameGroup(group.id, e.target.value)}
                              />
                            </Box>
                            <Box gap="4px">
                              <IconButton
                                size="small"
                                skin="light"
                                disabled={groupIdx === 0}
                                onClick={() => handleMoveGroup(groupIdx, 'up')}
                              >
                                <Icons.ChevronUp />
                              </IconButton>
                              <IconButton
                                size="small"
                                skin="light"
                                disabled={groupIdx === configurators.length - 1}
                                onClick={() => handleMoveGroup(groupIdx, 'down')}
                              >
                                <Icons.ChevronDown />
                              </IconButton>
                              <IconButton
                                size="small"
                                skin="light"
                                onClick={() => handleRemoveGroup(group.id)}
                              >
                                <Icons.Delete />
                              </IconButton>
                            </Box>
                          </Box>
                        }
                        suffix={
                          <Button size="tiny" prefixIcon={<Icons.Add />} onClick={() => handleAddOption(group.id)}>
                            Add Option
                          </Button>
                        }
                      />
                      <Card.Content>
                        {group.options.length === 0 ? (
                          <Text size="small" secondary>
                            No options. Click "Add Option" to define variables (e.g. Red, Blue).
                          </Text>
                        ) : (
                          <Box direction="vertical" gap="8px" width="100%">
                            {/* Headers */}
                            <Box direction="horizontal" gap="12px" width="100%" paddingBottom="4px" style={{ borderBottom: '1px solid #DFE5EB' }}>
                              <Text size="tiny" weight="bold" style={{ width: '60px', textAlign: 'center' }}>Choice Img</Text>
                              <Text size="tiny" weight="bold" style={{ width: '60px', textAlign: 'center' }}>Display Img</Text>
                              <Text size="tiny" weight="bold" style={{ width: '30%' }}>Option Name</Text>
                              <Text size="tiny" weight="bold" style={{ width: '20%' }}>Option Type</Text>
                              <Text size="tiny" weight="bold" style={{ width: '20%' }}>Price Adjustment (+/-)</Text>
                              <Text size="tiny" weight="bold" style={{ width: '120px', textAlign: 'center' }}>Reorder / Delete</Text>
                            </Box>

                            {/* Options List */}
                            {group.options.map((option: Option, optIdx: number) => (
                              <Box key={option.id} direction="horizontal" gap="12px" align="left" verticalAlign="middle" width="100%">
                                {/* Choice Image Picker */}
                                <Box style={{ width: '60px' }} align="center">
                                  {option.choiceImage ? (
                                    <div
                                      style={{ cursor: 'pointer', display: 'inline-block' }}
                                      onClick={() => handleSelectOptionImage(group.id, option.id, 'choiceImage')}
                                    >
                                      <Image
                                        src={getWixMediaUrl(option.choiceImage)}
                                        width="32px"
                                        height="32px"
                                        fit="contain"
                                        style={{ border: '1px solid #DFE5EB', borderRadius: '4px' }}
                                      />
                                    </div>
                                  ) : (
                                    <div style={{ cursor: 'pointer' }} onClick={() => handleSelectOptionImage(group.id, option.id, 'choiceImage')}>
                                      <Box
                                        width="32px"
                                        height="32px"
                                        align="center"
                                        verticalAlign="middle"
                                        style={{ border: '1px dashed #A0AAB2', borderRadius: '4px', backgroundColor: '#F8F9FA' }}
                                      >
                                        <Icons.Upload size="12px" style={{ color: '#A0AAB2' }} />
                                      </Box>
                                    </div>
                                  )}
                                </Box>

                                {/* Display Image Picker */}
                                <Box style={{ width: '60px' }} align="center">
                                  {option.displayImage ? (
                                    <div
                                      style={{ cursor: 'pointer', display: 'inline-block' }}
                                      onClick={() => handleSelectOptionImage(group.id, option.id, 'displayImage')}
                                    >
                                      <Image
                                        src={getWixMediaUrl(option.displayImage)}
                                        width="32px"
                                        height="32px"
                                        fit="contain"
                                        style={{ border: '1px solid #DFE5EB', borderRadius: '4px' }}
                                      />
                                    </div>
                                  ) : (
                                    <div style={{ cursor: 'pointer' }} onClick={() => handleSelectOptionImage(group.id, option.id, 'displayImage')}>
                                      <Box
                                        width="32px"
                                        height="32px"
                                        align="center"
                                        verticalAlign="middle"
                                        style={{ border: '1px dashed #A0AAB2', borderRadius: '4px', backgroundColor: '#F8F9FA' }}
                                      >
                                        <Icons.Upload size="12px" style={{ color: '#A0AAB2' }} />
                                      </Box>
                                    </div>
                                  )}
                                </Box>

                                {/* Option Name Input */}
                                <Box style={{ width: '30%' }}>
                                  <Input
                                    size="small"
                                    value={option.name}
                                    placeholder="e.g. Red, XL, Steel"
                                    onChange={(e) => handleUpdateOption(group.id, option.id, 'name', e.target.value)}
                                  />
                                </Box>

                                {/* Option Type Input */}
                                <Box style={{ width: '20%' }}>
                                  <Input
                                    size="small"
                                    value={option.type || ''}
                                    placeholder="e.g. Color, Size"
                                    onChange={(e) => handleUpdateOption(group.id, option.id, 'type', e.target.value)}
                                  />
                                </Box>

                                {/* Price Adjustment */}
                                <Box style={{ width: '20%' }}>
                                  <Input
                                    size="small"
                                    prefix={<Text>$</Text>}
                                    type="number"
                                    value={option.priceAdjustment || 0}
                                    placeholder="0.00"
                                    onChange={(e) => handleUpdateOption(group.id, option.id, 'priceAdjustment', Number(e.target.value))}
                                  />
                                </Box>

                                {/* Option Reordering & Deleting */}
                                <Box style={{ width: '120px' }} align="center" gap="4px">
                                  <IconButton
                                    size="tiny"
                                    skin="light"
                                    disabled={optIdx === 0}
                                    onClick={() => handleMoveOption(group.id, optIdx, 'up')}
                                  >
                                    <Icons.ChevronUp />
                                  </IconButton>
                                  <IconButton
                                    size="tiny"
                                    skin="light"
                                    disabled={optIdx === group.options.length - 1}
                                    onClick={() => handleMoveOption(group.id, optIdx, 'down')}
                                  >
                                    <Icons.ChevronDown />
                                  </IconButton>
                                  <IconButton
                                    size="tiny"
                                    skin="light"
                                    onClick={() => handleRemoveOption(group.id, option.id)}
                                  >
                                    <Icons.Delete />
                                  </IconButton>
                                </Box>
                              </Box>
                            ))}
                          </Box>
                        )}
                      </Card.Content>
                    </Card>
                  ))}
                </Box>
              )}
            </Box>

            {/* Bottom Actions Bar */}
            <Box gap="8px" align="right" borderTop="1px solid #DFE5EB" paddingTop="24px" marginTop="16px">
              <Button priority="secondary" onClick={onClose} disabled={loading}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={loading}>
                {loading ? 'Saving...' : 'Save Product'}
              </Button>
            </Box>
          </Box>
        </Page.Content>
      </Page>
    </WixDesignSystemProvider>
  );
};

export default Editor;
