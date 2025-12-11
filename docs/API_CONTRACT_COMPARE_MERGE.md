# ListMine Backend API Contract: Compare and Merge Retailer Lists

## Endpoint: POST /api/lists/compare-merge

### Request Body
```json
{
  "listMineListId": "uuid-string",
  "retailerList": [
    {
      "id": "retailer-item-id",
      "name": "string",
      "quantity": 1,
      "notes": "string",
      "purchased": false
    }
  ]
}
```

**Parameters:**
- `listMineListId` (UUID): The target ListMine list to compare against
- `retailerList` (Array): Items scraped from retailer
  - `id` (string, optional): Retailer item ID or unique link
  - `name` (string): Item name
  - `quantity` (number, optional): Item quantity
  - `notes` (string, optional): Additional notes
  - `purchased` (boolean, optional): Purchase status
  - Other relevant fields as needed

### Response Body
```json
{
  "existingItems": [
    {
      "id": "uuid",
      "name": "string",
      "quantity": 1,
      "notes": "string",
      "purchased": false
    }
  ],
  "newItems": [
    {
      "id": "retailer-item-id",
      "name": "string",
      "quantity": 1,
      "notes": "string",
      "purchased": false
    }
  ],
  "updatedItems": [
    {
      "listMineItem": {
        "id": "uuid",
        "name": "string",
        "quantity": 1,
        "notes": "string",
        "purchased": false
      },
      "retailerItem": {
        "id": "retailer-item-id",
        "name": "string",
        "quantity": 2,
        "notes": "updated notes",
        "purchased": false
      }
    }
  ],
  "summary": {
    "existingCount": 5,
    "newCount": 3,
    "updatedCount": 2
  }
}
```

**Response Fields:**
- `existingItems`: Items present only in ListMine
- `newItems`: Items present only in retailer list
- `updatedItems`: Items present in both but with differences
  - `listMineItem`: Current item in ListMine
  - `retailerItem`: Corresponding item from retailer
- `summary`: Object with counts of each category

### Client Usage
1. Client receives diff and displays checklist UI
2. User selects which items to add/update
3. Client sends selections back via merge endpoint

---

## Endpoint: POST /api/lists/merge

### Request Body
```json
{
  "listMineListId": "uuid-string",
  "itemsToAdd": [
    {
      "id": "retailer-item-id",
      "name": "string",
      "quantity": 1,
      "notes": "string",
      "purchased": false
    }
  ],
  "itemsToUpdate": [
    {
      "listMineItemId": "uuid",
      "name": "updated-name",
      "quantity": 2,
      "notes": "updated notes",
      "purchased": true
    }
  ]
}
```

**Parameters:**
- `listMineListId` (UUID): Target ListMine list
- `itemsToAdd` (Array): Retailer items to add to the list
- `itemsToUpdate` (Array): Items to update with new values
  - `listMineItemId` (UUID): ID of item to update
  - Other fields to update (name, quantity, notes, purchased, etc.)

### Response Body
```json
{
  "success": true,
  "message": "Successfully merged 3 new items and updated 2 existing items",
  "updatedList": {
    "id": "uuid",
    "user_id": "uuid",
    "title": "string",
    "category": "string",
    "list_type": "string",
    "items": [
      {
        "id": "uuid",
        "name": "string",
        "quantity": 1,
        "notes": "string",
        "purchased": false,
        "priority": "medium",
        "due_date": "2025-12-25"
      }
    ],
    "created_at": "2025-01-01T00:00:00Z",
    "updated_at": "2025-01-01T00:00:00Z"
  }
}
```

**Response Fields:**
- `success` (boolean): Operation success status
- `message` (string): Human-readable status message
- `updatedList`: Complete ListMine list after merge with all items
