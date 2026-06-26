/**
 * Data Collections Extension Registry
 * 
 * This file registers all data collection definitions for the app.
 * When the app is installed, these collections are auto-created in the site's CMS.
 */
import customProducts from './custom-products/collection';

export default {
  collections: [customProducts],
};
