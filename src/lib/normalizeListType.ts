export function normalizeListType(listType: string | null | undefined): string {
  if (!listType) return 'custom';
  switch (listType.toLowerCase()) {
    case 'todo-list':
    case 'todo':
    case 'task-list':
    case 'checklist':
      return 'todo';
    case 'idea-list':
    case 'idea':
      return 'idea';
    case 'shopping-list':
    case 'shopping':
      return 'shopping';
    case 'grocery-list':
    case 'grocery':
      return 'grocery';
    case 'registry-list':
    case 'registry':
      return 'registry';
    case 'wishlist':
      return 'wishlist';
    case 'custom':
    case 'job-search':
    case 'multi-topic':
    case 'compare-contrast':
    case 'pro-con':
    case 'multi-option':
      return 'custom';
    default:
      return 'custom';
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
