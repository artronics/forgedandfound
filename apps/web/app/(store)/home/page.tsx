"use client";
import {HeroSection} from "@/components/home/hero-section";
import {NewArrivalsSection} from "@/components/home/new-arrivals-section";
import {CategoryGridSection} from "@/components/home/category-grid-section";
import {OurStorySection} from "@/components/home/our-story-section";
import {NewsletterSection} from "@/components/home/newsletter-section";

export default function HomePage() {
  return (
    <main>
      <HeroSection/>
      <NewArrivalsSection/>
      <CategoryGridSection/>
      <OurStorySection/>
      <NewsletterSection/>
    </main>
  );
}
