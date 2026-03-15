export function normalizeListType(listType: string | null | undefined): string {
  if (!listType) return 'custom';
  switch (listType.toLowerCase()) {
    case 'todo-list':
    case 'todo':
    case 'task-list':
      return 'todo';
    case 'checklist':
      return 'checklist';
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
      return 'registry';
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

// Convert display type back to database type (canonical names)
export function displayTypeToDbType(displayType: string): string {
  switch (displayType) {
    case 'To-Do':
      return 'todo';
    case 'Checklist':
      return 'checklist';
    case 'Idea':
      return 'idea';
    case 'Shopping List':
      return 'shopping';
    case 'Grocery':
      return 'grocery';
    case 'Registry':
      return 'registry';
    case 'Registry/Wishlist':
      return 'registry';
    case 'Custom':
    default:
      return 'custom';
  }
}
