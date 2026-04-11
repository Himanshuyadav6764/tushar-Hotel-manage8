import { Star, Cloud, Globe, Box, Hexagon } from 'lucide-react';
import './TrustedBy.css';

const PARTNERS = [
  { name: 'TrustPilot', icon: <Star size={24} fill="currentColor" />, color: '#00b67a' },
  { name: 'DasHost', icon: <Cloud size={24} />, color: '#3b82f6' },
  { name: 'Cloudsail', icon: <Globe size={24} />, color: '#f59e0b' },
  { name: 'Webbsift', icon: <Box size={24} />, color: '#d41424' },
  { name: 'Neo Software', icon: <Hexagon size={24} />, color: '#10b981' },
];

const TrustedBy = () => {
  return (
    <section className="trusted-by-section">
      <div className="container trusted-by-container">
        <h3 className="trusted-by-title">Trusted by:</h3>
        <div className="trusted-by-grid">
          {PARTNERS.map((partner, i) => (
            <div key={i} className="trusted-brand" title={partner.name}>
              <span className="brand-icon" style={{ color: partner.color }}>{partner.icon}</span>
              <span className="brand-name">{partner.name}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default TrustedBy;
