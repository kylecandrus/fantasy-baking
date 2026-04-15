import type { Metadata } from 'next';
import Navbar from '@/components/Navbar';
import './globals.css';

export const metadata: Metadata = {
  title: 'Fantasy Bake Off',
  description: 'Family fantasy game for The Great British Baking Show',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-dvh flex flex-col">
        <Navbar />
        <main className="flex-1 w-full max-w-3xl mx-auto px-4 pt-4 pb-28 md:pb-8 md:pt-6">
          {children}
        </main>
      </body>
    </html>
  );
}
