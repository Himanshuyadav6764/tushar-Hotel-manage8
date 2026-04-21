import React from 'react';
import './ScrollingBrands.css';

const BRANDS = [
  "Swiggy",
  "Zomato",
  "Blinkit",
  "Uber Eats",
  "OYO",
  "Airbnb"
];

// Duplicate brands to create a flawless infinite scroll loop
const SCROLL_ITEMS = [...BRANDS, ...BRANDS, ...BRANDS];

const ScrollingBrands = () => {
  return (
    <section className="scrolling-brands-section py-8 bg-[#fff0f3] relative">
      <div className="max-w-6xl mx-auto px-6 mb-6">
        <h3 className="text-center text-gray-400 font-medium tracking-wide uppercase text-sm">
          Trusted by Leading Platforms
        </h3>
      </div>
      
      {/* Scroll Container with Fade Masks */}
      <div className="scrolling-wrapper relative w-full overflow-hidden">
        {/* Left and Right Gradient Fades */}
        <div className="absolute top-0 left-0 w-32 h-full bg-gradient-to-r from-[#fff0f3] to-transparent z-10 pointer-events-none"></div>
        <div className="absolute top-0 right-0 w-32 h-full bg-gradient-to-l from-[#fff0f3] to-transparent z-10 pointer-events-none"></div>

        {/* The continuously moving track */}
        <div className="scrolling-track flex items-center w-max gap-12 sm:gap-16">
          {SCROLL_ITEMS.map((brand, i) => (
            <div 
              key={i} 
              className="brand-item flex-shrink-0 text-gray-400 opacity-70 hover:opacity-100 hover:text-[#d41424] transition-all duration-300 font-black text-2xl tracking-tighter cursor-pointer"
            >
              {brand}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default ScrollingBrands;
