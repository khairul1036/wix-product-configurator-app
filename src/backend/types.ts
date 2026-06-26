export interface Option {
  id: string;
  name: string;
  type: string;
  choiceImage: string; // Wix Media URL for the choice swatch/thumbnail
  displayImage: string; // Wix Media URL for the display preview
  priceAdjustment: number;
  order: number;
}

export interface Configurator {
  id: string;
  title: string;
  options: Option[];
}

export interface Product {
  id: string; // Wix _id
  productName: string;
  shortDescription: string;
  basePrice: number;
  discountPrice?: number;
  image: string; // Wix Media URL
  configurators: Configurator[];
  status: 'Active' | 'Draft';
  createdAt: string; // Wix _createdDate
  updatedAt: string; // Wix _updatedDate
}
