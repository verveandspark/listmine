export function normalizeListType(listType: string | null | undefined): string {
  if (!listType) return 'Custom';
  switch (listType.toLowerCase()) {
    case 'todo-list':
    case 'todo':
    case 'task-list':
    case 'checklist':
      return 'To-Do';
    case 'idea-list':
    case 'idea':
      return 'Idea';
    case 'shopping-list':
    case 'shopping':
    case 'grocery-list':
    case 'grocery':
      return 'Shopping List';
    case 'registry-list':
    case 'registry':
      return 'Registry';
    case 'wishlist':
      return 'Wishlist';
    case 'custom':
    case 'job-search':
    case 'multi-topic':
    case 'compare-contrast':
    case 'pro-con':
    case 'multi-option':
      return 'Custom';
    default:
      return 'Custom';
  }
}

export const listTypeOptions = [
  'Custom',
  'To-Do',
  'Idea',
  'Shopping List',
  'Registry',
  'Wishlist',
];

// Convert display type back to database type
export function displayTypeToDbType(displayType: string): string {
  switch (displayType) {
    case 'To-Do':
      return 'todo-list';
    case 'Idea':
      return 'idea-list';
    case 'Shopping List':
      return 'shopping-list';
    case 'Registry':
      return 'registry-list';
    case 'Wishlist':
      return 'wishlist';
    case 'Custom':
    default:
      return 'custom';
  }
}
