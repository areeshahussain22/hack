import './globals.css';

export const metadata = {
  title: 'NovaCart Policy Assistant',
  description: "Ask questions about NovaCart's store policies, with cited answers.",
};

export const viewport = { width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
