import { DM_Sans, Fraunces, JetBrains_Mono } from "next/font/google";

import "./lumen.css";

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
  display: "swap",
});

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

/** Wraps every /learn/* route in the Lumen design scope. The .lm class
 *  carries the Lumen tokens (warm paper, indigo accent, six-hue palette)
 *  so they only apply inside this subtree — the rest of the app keeps
 *  the existing slate/cobalt visual system. */
export default function LearnLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`lm ${dmSans.variable} ${fraunces.variable} ${jetbrainsMono.variable}`}>
      {children}
    </div>
  );
}
