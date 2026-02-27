/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
        "./src/**/*.{js,ts,jsx,tsx,mdx}",
    ],
    theme: {
        extend: {
            colors: {
                background: "var(--background)",
                foreground: "var(--foreground)",
                primary: {
                    DEFAULT: "var(--primary)",
                    hover: "var(--primary-hover)",
                },
                card: "var(--bg-card)",
                border: "var(--border)",
            },
            fontFamily: {
                sans: ["Plus Jakarta Sans", "sans-serif"],
            },
        },
    },
    plugins: [],
}
