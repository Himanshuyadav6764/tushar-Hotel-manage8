import { MotionDiv, fadeRight, fadeLeft } from './MotionWrapper';
import Parallax from './Parallax';

const Vision = () => {
    return (
        <section className="pt-40 pb-24 md:pt-48 md:pb-32 flex items-center justify-center relative overflow-hidden bg-[#fff0f3]">
            {/* Background Aesthetics */}
            <div className="absolute top-[-100px] left-[-100px] w-[300px] h-[300px] bg-rose-50/50 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute bottom-[-100px] right-[-100px] w-[400px] h-[400px] bg-rose-50/50 rounded-full blur-3xl pointer-events-none" />

            <div className="max-w-[1340px] mx-auto grid grid-cols-1 md:grid-cols-2 gap-16 md:gap-24 items-center relative z-10 w-full px-6">


                {/* LEFT CONTENT - BALANCED POSITION */}
                <Parallax speed={20} className="vision-text-parallax flex justify-center md:justify-end">
                    <MotionDiv variant={fadeLeft} className="max-w-[550px] w-full text-center md:text-left">
                        <h2 className="text-[36px] md:text-[56px] font-[950] text-[#1f232b] tracking-tight mb-8 leading-[1.1]">
                            Our Vision
                        </h2>
                        <p className="text-[#64748b] text-[17px] md:text-[19px] leading-relaxed mb-10 opacity-90 font-semibold">
                            We automate hotel operations with real-time tracking of rooms, orders, and inventory.
                            Our mission is to improve customer experience through advanced CRM tools and provide
                            data-driven reports for better efficiency and growth.
                        </p>

                        <div className="space-y-5 inline-block text-left mx-auto md:mx-0">
                            {[
                                "Real-time Tracking",
                                "CRM & Reporting",
                                "Efficiency & Growth"
                            ].map((item, idx) => (
                                <div key={idx} className="flex items-center gap-4 group">
                                    <div className="w-7 h-7 rounded-full bg-rose-50 flex items-center justify-center text-[#d41424] group-hover:bg-[#d41424] group-hover:text-white transition-all duration-300 shadow-sm">
                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M5 13l4 4L19 7" />
                                        </svg>
                                    </div>
                                    <span className="text-[#1f232b] font-bold text-[17px] md:text-[18px] tracking-tight group-hover:text-[#d41424] transition-colors">{item}</span>
                                </div>
                            ))}
                        </div>
                    </MotionDiv>
                </Parallax>

                {/* RIGHT CONTENT - BLENDED ILLUSTRATION */}
                <Parallax speed={40} className="vision-img-parallax flex justify-center">
                    <MotionDiv variant={fadeRight} className="relative flex justify-center items-center h-full min-h-[350px] md:min-h-[450px] w-full">
                        <div className="relative mt-8 md:mt-0 flex justify-center scale-100 md:scale-125 md:translate-x-[80px]">
                            {/* Subtle Background Glow to match image hue */}
                            <div className="absolute inset-0 bg-rose-200/40 blur-[90px] rounded-full scale-110"></div>

                            <img
                                src="/images/Data-driven professional in front of hotel (1).png"
                                alt="Our Vision Illustration"
                                className="w-full max-w-[500px] md:max-w-[600px] h-auto object-contain relative z-10 opacity-95 transition-transform duration-700"
                                style={{
                                    maskImage: 'radial-gradient(circle, black 65%, transparent 100%)',
                                    WebkitMaskImage: 'radial-gradient(circle, black 65%, transparent 100%)'
                                }}
                            />
                        </div>
                    </MotionDiv>
                </Parallax>


            </div>
        </section>
    );
};

export default Vision;
