import type { Metadata } from 'next';
import { Fraunces, Instrument_Sans, Fragment_Mono } from 'next/font/google';
import './globals.css';
import { QueryProvider } from '@/providers/QueryProvider';
import { ThemeProvider } from '@/components/theme-provider';
import { Toaster } from '@/components/ui/sonner';

/**
 * Typography trio for the Darkroom / Editorial design system.
 * Both themes share the same fonts; the themes vary by weight, optical
 * size, and italic usage — not by family. This keeps the design
 * consistent while letting each theme have its own personality.
 */
const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-display',
  axes: ['opsz', 'SOFT'],
  display: 'swap',
});
const instrumentSans = Instrument_Sans({
  subsets: ['latin'],
  variable: '--font-body',
  display: 'swap',
});
const fragmentMono = Fragment_Mono({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-mono-feature',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'VisionTest.ai — watch every change',
  description:
    'A darkroom for your interface. Write test journeys as plain English, develop each step as a frame, and see what changed before your users do.',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      // Darkroom is the default theme; the ThemeProvider can set
      // data-theme="editorial" for the light variant. The `class`
      // attribute kept for back-compat with remaining .dark selectors.
      data-theme="darkroom"
      suppressHydrationWarning
    >
      <body
        className={`${fraunces.variable} ${instrumentSans.variable} ${fragmentMono.variable}`}
      >
        <ThemeProvider
          attribute="data-theme"
          defaultTheme="darkroom"
          themes={['darkroom', 'editorial']}
          enableSystem={false}
        >
          <QueryProvider>
            {children}
            <Toaster position="bottom-right" />
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
