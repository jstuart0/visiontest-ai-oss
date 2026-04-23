import type { Metadata } from 'next';
import { Major_Mono_Display, Space_Grotesk, JetBrains_Mono, Caveat } from 'next/font/google';
import './globals.css';
import { QueryProvider } from '@/providers/QueryProvider';
import { ThemeProvider } from '@/components/theme-provider';
import { Toaster } from '@/components/ui/sonner';

/**
 * Blueprint typography.
 * Major Mono Display — drafting-block display face, lowercase by default.
 * Space Grotesk    — body copy with a mechanical edge.
 * JetBrains Mono   — run IDs, timestamps, tabular figures, labels.
 * Caveat           — rare handwritten revision notes only.
 */
const majorMono = Major_Mono_Display({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-display',
  display: 'swap',
});
const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-body',
  display: 'swap',
});
const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono-feature',
  display: 'swap',
});
const caveat = Caveat({
  subsets: ['latin'],
  variable: '--font-hand',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'VisionTest.ai — Sheet 01 of N: Visual Regression, Drafted',
  description:
    'A drafting room for your interface. Every release is a revision; every diff, a redline. See what changed before your users do.',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      data-theme="blueprint"
      suppressHydrationWarning
    >
      <body
        className={`${majorMono.variable} ${spaceGrotesk.variable} ${jetbrainsMono.variable} ${caveat.variable}`}
      >
        <ThemeProvider
          attribute="data-theme"
          defaultTheme="blueprint"
          themes={['blueprint', 'paper']}
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
