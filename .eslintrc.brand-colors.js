/**
 * ESLint configuration for brand color enforcement
 * 
 * This file documents the forbidden Tailwind classes that should not be used.
 * To enforce this, add the no-restricted-syntax rule to your main ESLint config.
 * 
 * FORBIDDEN COLOR CLASSES:
 * - bg-green-*, text-green-*, border-green-* (use accent instead)
 * - bg-yellow-*, text-yellow-*, border-yellow-* (use warning sparingly)
 * - bg-purple-*, text-purple-*, border-purple-*
 * - bg-pink-*, text-pink-*, border-pink-*
 * - bg-indigo-*, text-indigo-*, border-indigo-*
 * - bg-blue-50, bg-blue-100, etc. (use primary/secondary with opacity)
 * - bg-teal-*, text-teal-*, border-teal-* (use accent instead)
 * 
 * ALLOWED SPECIAL CASES:
 * - text-amber-500, fill-amber-500 (ONLY for favorites star)
 * - bg-destructive, text-destructive (ONLY for delete/errors)
 * 
 * BRAND COLORS TO USE:
 * - primary, primary/10, primary/20, etc. (Brand Blue #1F628E)
 * - secondary, secondary/10, etc. (Secondary Blue #3D7A9E)
 * - accent, accent/10, etc. (Brand Teal #298585)
 * - muted, muted-foreground (Grays)
 * - destructive (Red - only for errors/delete)
 */

module.exports = {
  rules: {
    // Example rule to add to your main .eslintrc.js:
    // 'no-restricted-syntax': [
    //   'warn',
    //   {
    //     selector: 'Literal[value=/bg-green-|text-green-|border-green-/]',
    //     message: 'Use brand accent color instead of green. Replace with bg-accent/10, text-accent, etc.'
    //   },
    //   {
    //     selector: 'Literal[value=/bg-teal-|text-teal-|border-teal-/]',
    //     message: 'Use brand accent color instead of teal. Replace with bg-accent/10, text-accent, etc.'
    //   },
    //   {
    //     selector: 'Literal[value=/bg-blue-[0-9]|text-blue-[0-9]|border-blue-[0-9]/]',
    //     message: 'Use brand primary/secondary color instead of blue-*. Replace with bg-primary/10, text-primary, etc.'
    //   }
    // ]
  }
};
