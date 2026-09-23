import type { Metadata } from "next";
import { Fraunces, Public_Sans, IBM_Plex_Mono } from "next/font/google";
import { headers } from "next/headers";
import { Providers } from "./providers";
import "./globals.css";

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  display: "swap",
});

const publicSans = Public_Sans({
  variable: "--font-public-sans",
  subsets: ["latin"],
  display: "swap",
});

const ibmPlexMono = IBM_Plex_Mono({
  variable: "--font-ibm-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Zephyroute",
  description:
    "Move stablecoins or BTC from Ethereum, Arbitrum, or Bitcoin into Stellar yield in two wallet signatures.",
};

/**
 * Security review finding (see `proxy.ts`): `script-src` now requires a
 * fresh per-request nonce, so every route must render dynamically, a
 * static page has no request to derive a nonce from. `headers()` is
 * itself a request-time API that opts a route into dynamic rendering
 * just by being called, confirmed against this installed Next.js
 * version's own docs, so reading it here forces every page under this
 * root layout dynamic without needing a separate `force-dynamic`
 * export. No `<Script>` component exists in this codebase yet to hand
 * the nonce to directly, Next.js applies it to its own framework
 * scripts automatically once the CSP header carries it.
 */
export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  await headers();

  return (
    <html
      lang="en"
      className={`${fraunces.variable} ${publicSans.variable} ${ibmPlexMono.variable}`}
    >
      <body>
        <Providers>
          <div className="content-column">{children}</div>
        </Providers>
      </body>
    </html>
  );
}
