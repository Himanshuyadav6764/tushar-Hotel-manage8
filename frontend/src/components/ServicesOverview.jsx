import { motion } from 'framer-motion';
import { MotionDiv, fadeUp, containerStagger } from './MotionWrapper';
import {
    Hotel,           // Room Management
    CalendarCheck,   // Check-In / Check-Out
    UtensilsCrossed, // Restaurant Management
    Boxes,           // Inventory Management
    ClipboardList,   // Kitchen Order Ticket (KOT)
    Home,            // Housekeeping Tasks
    Users,           // Staff Management
    BarChart3,       // Business Reports
    CreditCard       // Smart Billing
} from 'lucide-react';

const ServicesOverview = () => {
    const allServices = [
        {
            icon: <Hotel className="w-8 h-8 text-white" />,
            name: "Room Management",
            desc: "Track room availability, bookings, and occupancy in real-time."
        },
        {
            icon: <CalendarCheck className="w-8 h-8 text-white" />,
            name: "Check-In / Check-Out",
            desc: "Fast and seamless guest check-in and checkout experience."
        },
        {
            icon: <UtensilsCrossed className="w-8 h-8 text-white" />,
            name: "Restaurant Management",
            desc: "Manage food orders, menus, and restaurant operations easily."
        },
        {
            icon: <Boxes className="w-8 h-8 text-white" />,
            name: "Inventory Management",
            desc: "Monitor stock levels and avoid shortages with smart alerts."
        },
        {
            icon: <ClipboardList className="w-8 h-8 text-white" />,
            name: "Kitchen Order Ticket (KOT)",
            desc: "Send orders to kitchen instantly with real-time tracking."
        },
        {
            icon: <Home className="w-8 h-8 text-white" />,
            name: "Housekeeping Tasks",
            desc: "Assign and monitor daily housekeeping duties effortlessly."
        },
        {
            icon: <Users className="w-8 h-8 text-white" />,
            name: "Staff Management",
            desc: "Manage staff roles, shifts, and performance efficiently."
        },
        {
            icon: <BarChart3 className="w-8 h-8 text-white" />,
            name: "Business Reports",
            desc: "Get detailed insights into revenue, bookings, and growth."
        },
        {
            icon: <CreditCard className="w-8 h-8 text-white" />,
            name: "Smart Billing",
            desc: "Generate accurate invoices with multiple payment options."
        }
    ];

    // Premium Stagger Logic: Cards will float up one-by-one as you scroll
    const cardAnimation = {
        hidden: {
            opacity: 0,
            y: 60,
            scale: 0.95
        },
        show: {
            opacity: 1,
            y: 0,
            scale: 1,
            transition: {
                type: "spring",
                stiffness: 100,
                damping: 20,
                duration: 0.8
            }
        }
    };

    return (
        <section className="bg-[#fff0f3] py-16 px-4 md:px-10 flex flex-col justify-center items-center font-sans overflow-hidden">
            <div className="w-full max-w-[1340px] mx-auto text-center">

                {/* Heading Segment - Entrance Animation */}
                <MotionDiv variant={fadeUp} className="mb-10 flex flex-col items-center">
                    <h2 className="text-[42px] md:text-[52px] font-extrabold text-[#1f2937] tracking-tight mb-4 leading-tight">
                        Our Services
                    </h2>
                    <div className="w-24 h-[6px] bg-[#d41424] rounded-full mb-8 shadow-[0_4px_12px_rgba(225,29,72,0.15)]"></div>
                    <p className="text-[#64748b] text-[18px] md:text-[20px] max-w-2xl mx-auto leading-relaxed px-4 opacity-90 font-medium">
                        Everything you need to automate your hotel business in one unified ecosystem.
                    </p>
                </MotionDiv>

                {/* THE MAGIC STAGGER GRID: Every card waits its turn to float in */}
                <motion.div
                    variants={containerStagger}
                    initial="hidden"
                    whileInView="show"
                    viewport={{ once: true, amount: 0.15 }}
                    className="grid grid-cols-2 lg:grid-cols-3 gap-4 md:gap-10 justify-items-center"
                >
                    {allServices.map((service, idx) => (
                        <motion.div
                            key={idx}
                            variants={cardAnimation}
                            whileHover={{
                                y: -10,
                                scale: 1.02,
                                transition: { duration: 0.3, ease: "easeOut" }
                            }}
                            className="bg-white rounded-[25px] md:rounded-[40px] flex flex-col items-center text-center shadow-[0_10px_35px_rgba(0,0,0,0.02)] border border-[#f3f4f6] hover:shadow-[0_25px_60px_rgba(225,29,72,0.1)] transition-all transform group w-full"
                            style={{ padding: '24px 16px' }}
                        >
                            {/* Icon with Glowing Bounce Effect */}
                            <div className="w-10 h-10 md:w-16 md:h-16 rounded-[12px] md:rounded-[24px] bg-[#d41424] flex items-center justify-center shadow-[0_5px_15px_rgba(225,29,72,0.2)] transition-all duration-500 group-hover:rotate-[360deg] group-hover:scale-110 mb-4 md:mb-8">
                                <span className="scale-75 md:scale-100">{service.icon}</span>
                            </div>

                            <h3 className="font-bold md:font-extrabold text-[#111827] text-[14px] md:text-[22px] leading-tight mb-2 md:mb-4 tracking-tight px-2">
                                {service.name}
                            </h3>

                            <p className="text-[#4b5563] text-[11px] md:text-[15.5px] leading-relaxed opacity-90 font-medium hidden md:block">
                                {service.desc}
                            </p>

                            {/* Short version for mobile if needed, or just keep it small */}
                            <p className="text-[#4b5563] text-[10px] leading-tight opacity-90 font-medium md:hidden line-clamp-2 px-1">
                                {service.desc}
                            </p>
                        </motion.div>
                    ))}
                </motion.div>


            </div>
        </section>
    );
};

export default ServicesOverview;
