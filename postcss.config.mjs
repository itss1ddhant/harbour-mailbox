// Tells the CSS build step to run Tailwind, which turns the class names used in the
// pages (for example "rounded-lg border p-4") into real CSS.

export default {
  plugins: { "@tailwindcss/postcss": {} },
};
