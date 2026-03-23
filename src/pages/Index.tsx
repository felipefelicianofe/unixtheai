import Header from "@/components/landing/Header";
import Hero from "@/components/landing/Hero";
import MarketMarquee from "@/components/landing/MarketMarquee";
import Features from "@/components/landing/Features";
import HowItWorks from "@/components/landing/HowItWorks";
import Pricing from "@/components/landing/Pricing";
import Footer from "@/components/landing/Footer";

const Index = () => (
  <div className="min-h-screen bg-background">
    <Header />
    <Hero />
    <MarketMarquee />
    <Features />
    <HowItWorks />
    <Pricing />
    <Footer />
  </div>
);

export default Index;
