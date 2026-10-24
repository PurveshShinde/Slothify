import React from 'react';
import { NavLink } from 'react-router-dom';
import { ShieldCheck, Scale, Github, Coffee } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

const Footer: React.FC = () => {
    const { isOcean } = useTheme();

    const linkClass = `
        inline-flex items-center gap-1.5 text-[11px] text-[#8a8489]
        hover:text-white transition-colors duration-150
    `;

    return (
        <footer className={`
            mt-auto mx-0 px-4 md:px-8 py-5
            border-t border-white/[0.05]
            bg-black/20 backdrop-blur-sm
        `}>
            <div className="max-w-screen-xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">

                {/* Left: Brand + copyright */}
                <div className="flex items-center gap-2 text-[11px] text-[#8a8489]">
                    <img
                        src="/favicon_sloth.png"
                        alt="Slothify"
                        className="w-4 h-4 object-contain opacity-60"
                    />
                    <span>© {new Date().getFullYear()} Slothify — for the ones who feel music, not just hear it.</span>
                </div>

                {/* Center: Legal links */}
                <nav className="flex items-center gap-4">
                    <NavLink to="/privacy" className={linkClass}>
                        <ShieldCheck size={12} />
                        <span>Privacy Policy</span>
                    </NavLink>
                    <span className="text-white/10 text-xs">·</span>
                    <NavLink to="/terms" className={linkClass}>
                        <Scale size={12} />
                        <span>Terms &amp; Conditions</span>
                    </NavLink>
                </nav>

                {/* Right: Contact / socials */}
                <div className="flex items-center gap-3">
                    <a
                        href="https://github.com/PurveshShinde"
                        target="_blank"
                        rel="noopener noreferrer"
                        className={linkClass}
                        title="GitHub — PurveshShinde"
                    >
                        <Github size={13} />
                        <span>PurveshShinde</span>
                    </a>
                    <span className="text-white/10 text-xs">·</span>
                    <a
                        href="https://buymeacoffee.com/purvesh.dev"
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`${linkClass} ${
                            isOcean
                                ? 'hover:text-cyan-300'
                                : 'hover:text-[#f5d0b5]'
                        }`}
                        title="Buy Me a Coffee"
                    >
                        <Coffee size={13} />
                        <span>Buy me a coffee</span>
                    </a>
                </div>
            </div>
        </footer>
    );
};

export default Footer;
