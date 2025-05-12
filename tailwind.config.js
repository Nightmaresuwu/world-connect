/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'primary': '#2563EB', // blue-600
        'accent': '#3B82F6',  // blue-500
        'success': '#10B981', // emerald-500
        'warning': '#F59E0B', // amber-500
        'danger': '#EF4444',  // red-500
      },
    },
  },
  plugins: [],
}