# ListMine Backend Pseudo-code: Compare and Merge Retailer Lists

## Function: compareAndMergeLists(listMineListId, retailerList)

1. Fetch existing items from ListMine list by listMineListId
2. Normalize and index items by unique keys (e.g., retailer ID or normalized name)
3. Normalize and index retailerList items similarly

4. Initialize arrays: existingItems, newItems, updatedItems

5. For each item in ListMine:
   - If not in retailerList keys, add to existingItems
   - Else if differs from retailerList item, add to updatedItems

6. For each item in retailerList:
   - If not in ListMine keys, add to newItems

7. Return { existingItems, newItems, updatedItems, summary }

## Function: mergeLists(listMineListId, itemsToAdd, itemsToUpdate)

1. For each item in itemsToAdd:
   - Insert into ListMine list with listMineListId

2. For each item in itemsToUpdate:
   - Update existing ListMine item by ID

3. Return success and updated list
