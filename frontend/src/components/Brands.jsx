import React from 'react';
import './Brands.css';
import { SiSwiggy, SiAirbnb } from 'react-icons/si';

export default function Brands() {

  // Real SVG+Text replicas for ultimate crispness on any device!
  const BrandLogos = [
    <div className="flex items-center gap-2 text-[#fc8019]">
      <SiSwiggy className="text-4xl" />
      <span className="font-bold text-2xl tracking-wide uppercase mt-1">Swiggy</span>
    </div>,
    <div className="text-[#e23744] font-black text-4xl tracking-tighter">
      zomato
    </div>,
    <div className="text-[#85aa22] font-black text-4xl tracking-tighter">
      blinkit
    </div>,
    <div className="text-black text-3xl font-normal leading-none tracking-tight flex items-baseline gap-1">
      <span className="font-semibold text-3xl">Uber</span> Eats
    </div>,
    <div className="text-[#ed1c24] font-black text-4xl tracking-tighter">
      OYO
    </div>,
    <div className="flex items-center gap-1 text-[#ff5a5f]">
      <SiAirbnb className="text-4xl" />
      <span className="font-bold text-3xl tracking-tight mt-1">airbnb</span>
    </div>
  ];

  return (
    <section className="py-16 md:py-24 relative z-20 w-full overflow-hidden mt-8 md:mt-20 bg-[#fff0f3]">

      {/* Title */}
      <h3 className="text-center text-[#8e98a8] text-xs md:text-sm tracking-widest font-bold uppercase mb-10 px-4">
        TRUSTED BY LEADING PLATFORMS
      </h3>

      {/* Full-width glowing wrapper spanning entire screen */}
      <div className="relative w-full py-10 bg-[#fff0f3] border-y border-white/60 shadow-[0_0_50px_rgba(255,255,255,0.7)] backdrop-blur-sm">


        {/* Fade Left matching theme background */}
        <div className="absolute left-0 top-0 w-48 h-full bg-gradient-to-r from-[#fff0f3] to-transparent z-10 pointer-events-none"></div>

        {/* Fade Right matching theme background */}
        <div className="absolute right-0 top-0 w-48 h-full bg-gradient-to-l from-[#fff0f3] to-transparent z-10 pointer-events-none"></div>

        {/* Scrolling */}
        <div className="flex gap-20 animate-scroll items-center w-max px-10">

          {[...BrandLogos, ...BrandLogos].map((el, i) => (
            <div
              key={i}
              className="flex-shrink-0 cursor-pointer opacity-85 hover:opacity-100 hover:scale-[1.03] transition-all duration-300 drop-shadow-md"
            >
              {el}
            </div>
          ))}

        </div>

      </div>
    </section>
  );
}
