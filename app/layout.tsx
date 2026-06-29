import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Fuel Scanner',
  description: 'Live fuel price API — fuelscanner.dynamiccode.app',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
