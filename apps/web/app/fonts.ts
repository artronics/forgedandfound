import {Inter, Noto_Serif} from "next/font/google";
import localFont from "next/font/local";

export const inter = Inter({
  subsets: ["latin"],
  axes: ["opsz"],
  weight: "variable",
  style: ["normal", "italic"],
  variable: "--font-inter",
  display: "swap",
});

export const noto_serif = Noto_Serif({
  subsets: ["latin"],
  axes: ["wdth"],
  weight: "variable",
  style: ["normal", "italic"],
  variable: "--font-noto-serif",
  display: "swap",
});

export const fiona = localFont({
  src: "../public/fonts/Fiona-Regular.woff2",
  variable: "--font-fiona",
  display: "swap",
});
