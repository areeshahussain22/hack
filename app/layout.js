import localFont from 'next/font/local';
import './globals.css';

// Fonts live in the repo (app/fonts, OFL licence) so builds never depend on reaching Google.
const sans = localFont({ src: './fonts/SourceSans3-latin-var.woff2', weight: '400 700', variable: '--font-sans', display: 'swap' });
const urdu = localFont({ src: './fonts/NotoNastaliqUrdu-arabic-var.woff2', weight: '400 700', variable: '--font-urdu', display: 'swap', preload: false });

export const metadata = {
  title: 'NovaBot · NovaCart policy help',
  description: "Answers from NovaCart's policies, with sources.",
};

export const viewport = { width: 'device-width', initialScale: 1, themeColor: '#161714' };

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${sans.variable} ${urdu.variable}`}>
      <body>{children}</body>
    </html>
  );
}
