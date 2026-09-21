/**
 * Token-discipline hard gate (Story 1.2, UX-DR1): no hardcoded color value
 * may appear anywhere outside the single file where design tokens are
 * defined. Every component must reference a var(--color-*) token instead.
 */
const config = {
  extends: ['stylelint-config-standard'],
  rules: {
    'color-no-hex': true,
    'color-function-notation': null,
    'declaration-property-value-disallowed-list': {
      '/^(color|background|background-color|border|border-color|outline|outline-color|fill|stroke)$/':
        ['/rgb\\(/', '/rgba\\(/', '/hsl\\(/', '/hsla\\(/'],
    },
  },
  overrides: [
    {
      files: ['**/app/globals.css'],
      rules: {
        'color-no-hex': null,
        'declaration-property-value-disallowed-list': null,
      },
    },
    {
      // CSS Modules convention: camelCase class names for ergonomic JS
      // access (styles.feeRow), not kebab-case.
      files: ['**/*.module.css'],
      rules: {
        'selector-class-pattern': '^[a-z][a-zA-Z0-9]*$',
      },
    },
  ],
};

export default config;
