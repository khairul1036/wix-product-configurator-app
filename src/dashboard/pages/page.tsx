import React, { type FC, useState, useEffect } from 'react';
import { dashboard } from '@wix/dashboard';
import {
  WixDesignSystemProvider,
  Page,
  Button,
  Card,
  Table,
  EmptyState,
  Text,
  Box,
  Input,
  Dropdown,
  Loader,
  IconButton,
  Image,
} from '@wix/design-system';
import '@wix/design-system/styles.global.css';
import * as Icons from '@wix/wix-ui-icons-common';

import { getProducts, deleteProduct } from 'backend/products.web';
import { Product } from '../../backend/types';
import Editor from './Editor';

// Helper: render any image URL – handles both HTTP and wix:image:// formats
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

const Index: FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [view, setView] = useState<'list' | 'editor'>('list');
  const [activeProductId, setActiveProductId] = useState<string | null>(null);

  // Load products from backend on mount and filter change
  const fetchProductsList = async (search?: string, status?: string) => {
    setLoading(true);
    try {
      const list = await getProducts(search || undefined, status || undefined);
      setProducts(list);
    } catch (err: any) {
      console.error('Error fetching products list:', err);
      dashboard.showToast({
        message: 'Could not fetch products. Make sure CustomProducts collection is configured.',
        type: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProductsList(searchQuery, statusFilter);
  }, [searchQuery, statusFilter]);

  // Handle Add Product button click
  const handleAddProduct = () => {
    setActiveProductId(null);
    setView('editor');
  };

  // Handle Edit Product click
  const handleEditProduct = (id: string) => {
    setActiveProductId(id);
    setView('editor');
  };

  // Handle Delete Product click
  const handleDeleteProduct = async (id: string) => {
    const confirmation = window.confirm('Are you sure you want to delete this custom product and all of its configurations?');
    if (!confirmation) return;

    try {
      await deleteProduct(id);
      dashboard.showToast({
        message: 'Product deleted successfully!',
        type: 'success',
      });
      fetchProductsList(searchQuery, statusFilter);
    } catch (err) {
      console.error('Error deleting product:', err);
      dashboard.showToast({
        message: 'Failed to delete the product.',
        type: 'error',
      });
    }
  };

  // Columns definition for Wix Design System Table
  const columns = [
    {
      title: 'Image',
      render: (row: Product) => (
        <Image
          src={getWixMediaUrl(row.image)}
          width="48px"
          height="48px"
          fit="contain"
          style={{ border: '1px solid #DFE5EB', borderRadius: '4px', padding: '2px', backgroundColor: '#F8F9FA' }}
        />
      ),
      width: '60px',
    },
    {
      title: 'Product Name',
      render: (row: Product) => (
        <Box direction="vertical">
          <Text weight="bold">{row.productName}</Text>
          <Text size="small" secondary>{row.shortDescription ? row.shortDescription.substring(0, 45) + (row.shortDescription.length > 45 ? '...' : '') : '-'}</Text>
        </Box>
      ),
      width: '200px',
    },
    {
      title: 'Base Price',
      render: (row: Product) => <Text>${row.basePrice.toFixed(2)}</Text>,
      width: '90px',
    },
    {
      title: 'Discount Price',
      render: (row: Product) =>
        row.discountPrice ? (
          <Text style={{ color: '#D6453D', fontWeight: 'bold' }}>${row.discountPrice.toFixed(2)}</Text>
        ) : (
          <Text secondary>-</Text>
        ),
      width: '110px',
    },
    {
      title: 'Configurator Options',
      render: (row: Product) => {
        const groupsCount = row.configurators?.length || 0;
        const optionsCount = row.configurators?.reduce((acc, curr) => acc + (curr.options?.length || 0), 0) || 0;
        return (
          <Box direction="vertical">
            <Text weight="bold">{groupsCount} Configurator {groupsCount === 1 ? 'Group' : 'Groups'}</Text>
            <Text size="small" secondary>{optionsCount} Total {optionsCount === 1 ? 'Option' : 'Options'}</Text>
          </Box>
        );
      },
      width: '180px',
    },
    {
      title: 'Status',
      render: (row: Product) => (
        <span
          style={{
            display: 'inline-block',
            padding: '4px 10px',
            borderRadius: '16px',
            fontSize: '11px',
            fontWeight: 'bold',
            backgroundColor: row.status === 'Active' ? '#E3F2FD' : '#ECEFF1',
            color: row.status === 'Active' ? '#1E88E5' : '#546E7A',
          }}
        >
          {row.status}
        </span>
      ),
      width: '80px',
    },
    {
      title: 'Created Date',
      render: (row: Product) => (
        <Text size="small">
          {row.createdAt ? new Date(row.createdAt).toLocaleDateString() : '-'}
        </Text>
      ),
      width: '100px',
    },
    {
      title: 'Actions',
      render: (row: Product) => (
        <Box gap="8px">
          <IconButton size="small" skin="light" onClick={() => handleEditProduct(row.id)}>
            <Icons.Edit />
          </IconButton>
          <IconButton size="small" skin="light" onClick={() => handleDeleteProduct(row.id)}>
            <Icons.Delete />
          </IconButton>
        </Box>
      ),
      width: '100px',
    },
  ];

  if (view === 'editor') {
    return (
      <Editor
        productId={activeProductId}
        onClose={() => {
          setView('list');
          fetchProductsList(searchQuery, statusFilter);
        }}
      />
    );
  }

  return (
    <WixDesignSystemProvider>
      <Page>
        <Page.Header
          title="Product Management Dashboard"
          subtitle="Create and customize product configurators with unlimited option layers independently from standard Wix Store editors."
          actionsBar={
            <Button onClick={handleAddProduct} prefixIcon={<Icons.Add />}>
              Add Product
            </Button>
          }
        />
        <Page.Content>
          <Box direction="vertical" gap="24px" width="100%">
            <Card>
              <Card.Content>
                {/* Search & Filters Toolbar */}
                <Box direction="horizontal" gap="16px" marginBottom="16px" verticalAlign="middle" width="100%">
                  <Box width="60%">
                    <Input
                      placeholder="Search products by name..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      prefix={<Icons.Search />}
                    />
                  </Box>
                  <Box width="40%">
                    <Dropdown
                      options={[
                        { id: 'All', value: 'All Statuses' },
                        { id: 'Active', value: 'Active Only' },
                        { id: 'Draft', value: 'Draft Only' },
                      ]}
                      selectedId={statusFilter}
                      onSelect={(option) => setStatusFilter(option.id as string)}
                      placeholder="Filter by Status"
                    />
                  </Box>
                </Box>

                {/* Table Data State */}
                {loading ? (
                  <Box height="300px" align="center" verticalAlign="middle" direction="vertical">
                    <Loader size="large" />
                    <Box marginTop="12px">
                      <Text>Loading products and custom configurator data...</Text>
                    </Box>
                  </Box>
                ) : products.length === 0 ? (
                  <EmptyState
                    title="No custom products found"
                    subtitle={
                      searchQuery || statusFilter !== 'All'
                        ? 'Try modifying your search queries or clearing active status filters.'
                        : 'Start by creating your first customizable product with configurator groups!'
                    }
                    skin="page"
                  >
                    {!searchQuery && statusFilter === 'All' && (
                      <Button size="small" prefixIcon={<Icons.Add />} onClick={handleAddProduct}>
                        Create Product
                      </Button>
                    )}
                  </EmptyState>
                ) : (
                  <Table data={products} columns={columns}>
                    <Table.Content />
                  </Table>
                )}
              </Card.Content>
            </Card>
          </Box>
        </Page.Content>
      </Page>
    </WixDesignSystemProvider>
  );
};

export default Index;
