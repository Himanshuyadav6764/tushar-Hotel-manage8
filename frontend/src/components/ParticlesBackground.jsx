import { useEffect, useRef } from 'react';
import './ParticlesBackground.css';

const ParticlesBackground = () => {
    const canvasRef = useRef(null);
    const containerRef = useRef(null);

    // Background Particles Logic
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        let width, height;
        let particles = [];
        const particleCount = 35; // Max 30-40

        const resize = () => {
            width = canvas.width = canvas.parentElement.offsetWidth;
            height = canvas.height = canvas.parentElement.offsetHeight;
        };

        class Particle {
            constructor() {
                this.reset();
            }

            reset() {
                this.x = Math.random() * width;
                this.y = Math.random() * height;
                this.speedX = (Math.random() - 0.5) * 0.2; // Slow random sideways
                this.speedY = -Math.random() * 0.3 - 0.1; // Slow upward
                this.size = Math.random() * 2 + 1; // Small size
                this.opacity = Math.random() * 0.15 + 0.1; // 0.1 - 0.25
                this.type = Math.random() > 0.8 ? 'star' : 'dot'; // 20% stars
            }

            update() {
                this.x += this.speedX;
                this.y += this.speedY;

                // Wrap around
                if (this.y < -10) this.y = height + 10;
                if (this.x < -10) this.x = width + 10;
                if (this.x > width + 10) this.x = -10;
            }

            draw() {
                ctx.fillStyle = `rgba(200, 200, 200, ${this.opacity})`; // Light gray/white
                ctx.beginPath();
                if (this.type === 'star') {
                    // Simple diamond shape for star
                    ctx.moveTo(this.x, this.y - this.size);
                    ctx.lineTo(this.x + this.size, this.y);
                    ctx.lineTo(this.x, this.y + this.size);
                    ctx.lineTo(this.x - this.size, this.y);
                } else {
                    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
                }
                ctx.fill();
            }
        }

        const init = () => {
            resize();
            particles = [];
            for (let i = 0; i < particleCount; i++) {
                particles.push(new Particle());
            }
        };

        const animate = () => {
            ctx.clearRect(0, 0, width, height);
            particles.forEach(p => {
                p.update();
                p.draw();
            });
            requestAnimationFrame(animate);
        };

        init();
        window.addEventListener('resize', resize);
        const animId = requestAnimationFrame(animate);

        return () => {
            window.removeEventListener('resize', resize);
            cancelAnimationFrame(animId);
        };
    }, []);

    // Cursor Sparkle Logic
    useEffect(() => {
        // Disable on mobile
        if (window.matchMedia('(max-width: 768px)').matches) return;

        const container = containerRef.current;
        if (!container) return;

        let lastTime = 0;
        const interval = 50; // Throttle spawn rate

        const createSparkle = (x, y) => {
            const sparkle = document.createElement('div');
            sparkle.classList.add('cursor-sparkle');

            // Randomize style slightly
            const size = Math.random() * 6 + 4; // 4-10px
            sparkle.style.width = `${size}px`;
            sparkle.style.height = `${size}px`;
            sparkle.style.left = `${x}px`;
            sparkle.style.top = `${y}px`;

            // Random color tint
            const colors = ['#ffffff', '#ffccd5', '#d41424']; // White, Pink, Red
            sparkle.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];

            // Use clip-path for star shape
            sparkle.style.clipPath = 'polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)';

            container.appendChild(sparkle);

            // Remove after animation
            setTimeout(() => {
                sparkle.remove();
            }, 800);
        };

        const handleMouseMove = (e) => {
            const now = Date.now();
            if (now - lastTime < interval) return;
            lastTime = now;

            // Get relative coordinates
            const rect = container.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            // Spawn 1-2 particles
            const count = Math.random() > 0.7 ? 2 : 1;
            for (let i = 0; i < count; i++) {
                // Add slight randomness to offset
                const offsetX = (Math.random() - 0.5) * 20;
                const offsetY = (Math.random() - 0.5) * 20;
                createSparkle(x + offsetX, y + offsetY);
            }
        };

        container.addEventListener('mousemove', handleMouseMove);
        return () => {
            container.removeEventListener('mousemove', handleMouseMove);
        };
    }, []);

    return (
        <div className="particles-container" ref={containerRef}>
            <canvas ref={canvasRef} className="particles-canvas" />
        </div>
    );
};

export default ParticlesBackground;
