import { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  return res.status(200).json({ message: 'API handler reached' });
}

const existingItems = [];
const newItems = [];
const updatedItems = [];

// Find items only in ListMine or updated
Object.keys(existingItemsIndex).forEach(key => {
  if (!retailerItemsIndex[key]) {
    existingItems.push(existingItemsIndex[key]);
  } else {
    const listMineItem = existingItemsIndex[key];
    const retailerItem = retailerItemsIndex[key];
    // Simple deep comparison for differences (can be improved)
    if (JSON.stringify(listMineItem) !== JSON.stringify(retailerItem)) {
      updatedItems.push({ listMineItem, retailerItem });
    }
  }
});

// Find items only in retailer list
Object.keys(retailerItemsIndex).forEach(key => {
  if (!existingItemsIndex[key]) {
    newItems.push(retailerItemsIndex[key]);
  }
});

const summary = {
  existingCount: existingItems.length,
  newCount: newItems.length,
  updatedCount: updatedItems.length,
};

res.status(200).json({
  existingItems,
  newItems,
  updatedItems,
  summary,
});
