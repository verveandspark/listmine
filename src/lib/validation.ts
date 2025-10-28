// Validation utilities for user inputs

export interface ValidationResult {
  valid: boolean;
  error?: string;
  value?: string;
}

// Sanitize input to prevent XSS and SQL injection
export function sanitizeInput(input: string): string {
  if (!input) return '';
  
  // Remove script tags
  let sanitized = input.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  
  // Remove SQL injection attempts
  sanitized = sanitized.replace(/(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE)\b)/gi, '');
  
  // Remove other potentially dangerous HTML tags
  sanitized = sanitized.replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '');
  sanitized = sanitized.replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '');
  
  // Trim whitespace
  sanitized = sanitized.trim();
  
  return sanitized;
}

// Validate list name
export function validateListName(name: string): ValidationResult {
  if (!name || name.trim().length === 0) {
    return { valid: false, error: "List name is required" };
  }
  
  if (name.length > 100) {
    return { valid: false, error: `List name must be 100 characters or less (${name.length}/100)` };
  }
  
  const sanitized = sanitizeInput(name);
  
  if (sanitized.length === 0) {
    return { valid: false, error: "List name contains invalid characters" };
  }
  
  return { valid: true, value: sanitized };
}

// Validate item name
export function validateItemName(name: string): ValidationResult {
  if (!name || name.trim().length === 0) {
    return { valid: false, error: "Item name is required" };
  }
  
  if (name.length > 500) {
    return { valid: false, error: `Item name must be 500 characters or less (${name.length}/500)` };
  }
  
  const sanitized = sanitizeInput(name);
  
  return { valid: true, value: sanitized };
}

// Validate email
export function validateEmail(email: string): ValidationResult {
  if (!email || email.trim().length === 0) {
    return { valid: false, error: "Email is required" };
  }
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  
  if (!emailRegex.test(email)) {
    return { valid: false, error: "Please enter a valid email address" };
  }
  
  return { valid: true, value: email.trim().toLowerCase() };
}

// Validate tag
export function validateTag(tag: string): ValidationResult {
  if (!tag || tag.trim().length === 0) {
    return { valid: false, error: "Tag cannot be empty" };
  }
  
  if (tag.length > 30) {
    return { valid: false, error: `Tag must be 30 characters or less (${tag.length}/30)` };
  }
  
  // Only allow alphanumeric, hyphens, underscores
  const tagRegex = /^[a-zA-Z0-9_-]+$/;
  const sanitized = tag.trim().toLowerCase().replace(/\s+/g, '-');
  
  if (!tagRegex.test(sanitized)) {
    return { valid: false, error: "Tag can only contain letters, numbers, hyphens, and underscores" };
  }
  
  return { valid: true, value: sanitized };
}

// Validate notes/description
export function validateNotes(notes: string): ValidationResult {
  if (!notes) {
    return { valid: true, value: '' };
  }
  
  if (notes.length > 2000) {
    return { valid: false, error: `Notes must be 2000 characters or less (${notes.length}/2000)` };
  }
  
  const sanitized = sanitizeInput(notes);
  
  return { valid: true, value: sanitized };
}

// Validate quantity
export function validateQuantity(quantity: number | undefined): ValidationResult {
  if (quantity === undefined || quantity === null) {
    return { valid: true, value: undefined };
  }
  
  if (isNaN(quantity)) {
    return { valid: false, error: "Quantity must be a number" };
  }
  
  if (quantity < 1) {
    return { valid: false, error: "Quantity must be at least 1" };
  }
  
  if (quantity > 9999) {
    return { valid: false, error: "Quantity must be 9999 or less" };
  }
  
  return { valid: true, value: Math.floor(quantity).toString() };
}

// Validate category
export function validateCategory(category: string): ValidationResult {
  if (!category || category.trim().length === 0) {
    return { valid: false, error: "Category is required" };
  }
  
  if (category.length > 50) {
    return { valid: false, error: `Category must be 50 characters or less (${category.length}/50)` };
  }
  
  const sanitized = sanitizeInput(category);
  
  // Capitalize first letter
  const formatted = sanitized.charAt(0).toUpperCase() + sanitized.slice(1);
  
  return { valid: true, value: formatted };
}

// Validate due date
export function validateDueDate(date: Date | undefined): ValidationResult {
  if (!date) {
    return { valid: true, value: undefined };
  }
  
  if (!(date instanceof Date) || isNaN(date.getTime())) {
    return { valid: false, error: "Invalid date format" };
  }
  
  // Optional: Check if date is in the past
  // const now = new Date();
  // if (date < now) {
  //   return { valid: false, error: "Due date cannot be in the past" };
  // }
  
  return { valid: true, value: date.toISOString() };
}

// Validate password
export function validatePassword(password: string): ValidationResult {
  if (!password || password.length === 0) {
    return { valid: false, error: "Password is required" };
  }
  
  if (password.length < 8) {
    return { valid: false, error: "Password must be at least 8 characters" };
  }
  
  // Optional: Check for strength
  // const hasNumber = /\d/.test(password);
  // const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(password);
  // if (!hasNumber && !hasSpecial) {
  //   return { valid: false, error: "Password must contain at least one number or special character" };
  // }
  
  return { valid: true, value: password };
}

// Validate import data
export function validateImportData(data: string): ValidationResult {
  if (!data || data.trim().length === 0) {
    return { valid: false, error: "Import data is empty" };
  }
  
  const lines = data.split('\n').filter(line => line.trim().length > 0);
  
  if (lines.length === 0) {
    return { valid: false, error: "Import data contains no valid items" };
  }
  
  if (lines.length > 100) {
    return { valid: false, error: `Import must contain 1-100 items (found ${lines.length})` };
  }
  
  // Check each line length
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].length > 500) {
      return { valid: false, error: `Line ${i + 1} is too long (max 500 characters)` };
    }
  }
  
  return { valid: true, value: data };
}

// Validate assigned to field
export function validateAssignedTo(assignedTo: string): ValidationResult {
  if (!assignedTo || assignedTo.trim().length === 0) {
    return { valid: true, value: '' };
  }
  
  if (assignedTo.length > 100) {
    return { valid: false, error: `Name must be 100 characters or less (${assignedTo.length}/100)` };
  }
  
  const sanitized = sanitizeInput(assignedTo);
  
  return { valid: true, value: sanitized };
}

// Check tier limits
export function checkListLimit(currentCount: number, limit: number): ValidationResult {
  if (limit === -1) {
    return { valid: true };
  }
  
  if (currentCount >= limit) {
    return { valid: false, error: `You've reached your limit of ${limit} lists. Upgrade to create more.` };
  }
  
  return { valid: true };
}

export function checkItemLimit(currentCount: number, limit: number): ValidationResult {
  if (limit === -1) {
    return { valid: true };
  }
  
  if (currentCount >= limit) {
    return { valid: false, error: `You've reached your limit of ${limit} items per list. Upgrade to add more.` };
  }
  
  return { valid: true };
}
