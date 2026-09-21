import type { Metadata, Viewport } from 'next';
import Navbar from '@/components/Navbar';
import OnboardingMount from '@/components/OnboardingMount';
import './globals.css';

const title = 'Fantasy Bake Off';
const description = 'Family fantasy game for The Great British Baking Show';

export const metadata: Metadata = {
  title,
  description,
  openGraph: {
    title,
    description,
    type: 'website',
    siteName: title,
  },
  appleWebApp: {
    title,
    capable: true,
    statusBarStyle: 'default',
  },
};

export const viewport: Viewport = {
  themeColor: '#C8902E',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-dvh flex flex-col">
        <Navbar />
        <main className="flex-1 w-full max-w-4xl mx-auto px-4 pt-4 pb-28 md:px-6 md:pb-10 md:pt-8">
          {children}
        </main>
        {/* Mounted globally (not just on the home page) so a player whose
            first link is e.g. /picks still sees the onboarding guide. */}
        <OnboardingMount />
      </body>
    </html>
  );
}
