import type { Metadata } from "next";
import { IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import Providers from "./providers";
import {BackstopProvider} from '@/context/BackstopContext';
import ErrorBoundary from '@/components/ErrorBoundary';

const ibmPlexSans = IBM_Plex_Sans({
  variable: "--font-ibm-plex-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const ibmPlexMono = IBM_Plex_Mono({
  variable: "--font-ibm-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Confidential Liquidation Backstop",
  description: "1inch Aqua/SwapVM + Chainlink CRE + Privy",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${ibmPlexSans.variable} ${ibmPlexMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <Providers>
          <BackstopProvider>
            <ErrorBoundary>
              {children}
            </ErrorBoundary>
          </BackstopProvider>
        </Providers>
      </body>
    </html>
  );
}
