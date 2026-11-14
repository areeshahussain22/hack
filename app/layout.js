import './globals.css';
import { Noto_Nastaliq_Urdu } from 'next/font/google';

// Nastaliq is the usual style for Urdu text. Exposed as a CSS variable, used only for Urdu bubbles.
const urdu = Noto_Nastaliq_Urdu({ subsets: ['arabic'], weight: ['400', '600'], display: 'swap', variable: '--font-urdu' });

export const metadata = {
  title: 'NovaCart Policy Assistant',
  description: "Ask questions about NovaCart's store policies, with cited answers. English, اردو and Roman Urdu.",
};

export const viewport = { width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={urdu.variable}>
      <body>{children}</body>
    </html>
  );
}
