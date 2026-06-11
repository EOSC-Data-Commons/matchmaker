import {Link} from 'react-router';
import {FaLinkedin} from 'react-icons/fa';
import {FaBluesky} from 'react-icons/fa6';
import {MdEmail} from 'react-icons/md';
import eoscLogo from '@/assets/logo-eosc-data-commons.svg';
import euLogo from '@/assets/EU_blue.png';
import {version} from '../../package.json';

interface FooterProps {
    translucent?: boolean;
    className?: string;
}

export const Footer = ({translucent = false, className = ''}: FooterProps) => {
    const base = 'py-8 border-t border-eosc-border w-full relative mt-8';
    const trans = translucent ? ' bg-white/60 backdrop-blur-sm' : '';
    const fullClass = `${base}${trans}${className ? ' ' + className : ''}`;

    return (
        <footer className={fullClass}>
            <div className="px-4 sm:px-6">
                <div className="flex flex-col md:flex-row justify-between items-center gap-8">
                    {/* Left: e-INFRA CZ Acknowledgement */}
                    <div className="flex-1 flex flex-col items-center md:items-start gap-2">
                        <a
                            href="https://www.e-infra.cz/en"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 hover:opacity-80 transition-opacity"
                            aria-label="e-INFRA CZ website"
                        >
                            <img
                                src="https://www.e-infra.cz/img/logo.svg"
                                alt="e-INFRA CZ"
                                className="h-8 w-auto"
                            />
                        </a>
                        <div className="text-xs font-light text-center md:text-left max-w-xs">
                            <p className="text-[10px] text-gray-500">
                                Computational resources provided by e-INFRA CZ (ID:90254), supported by Ministry of
                                Education, Youth and Sports of the Czech Republic
                            </p>
                        </div>
                    </div>

                    {/* Center text */}
                    <div className="text-center md:flex-1">
                        <p className="text-sm font-light text-eosc-gray">
                            Made with ❤️ in Europe 🇪🇺
                        </p>
                        <p className="text-xs font-light text-eosc-gray mt-1">
                            <a
                                href="https://github.com/EOSC-Data-Commons/matchmaker/blob/main/CHANGELOG.md"
                                target="_blank"
                                rel="noopener noreferrer"
                                className={"hover:text-eosc-dark-blue transition-colors"}
                                aria-label="View Changelog"
                                style={{textDecoration: 'none'}}
                            >
                                v{version}
                            </a>
                        </p>
                        <p className="text-xs font-light text-eosc-gray mt-1">
                            <Link
                                to="/privacy-policy"
                                className="hover:text-eosc-dark-blue transition-colors"
                            >
                                Privacy Policy
                            </Link>
                        </p>
                    </div>

                    {/* Right: Logo and Social Links */}
                    <div className="flex-1 flex flex-col items-center md:items-end gap-2">
                        <a
                            target="_blank"
                            rel="noreferrer"
                            href="https://www.eosc-data-commons.eu"
                            aria-label="Link to Homepage"
                            className="cursor-pointer"
                        >
                            <div className="w-64">
                                <div className="w-full h-16 flex items-center justify-center text-sm">
                                    <img
                                        src={eoscLogo}
                                        alt="EOSC Data Commons"
                                        className="w-full max-w-lg h-auto"
                                    />
                                </div>
                            </div>
                        </a>

                        {/* EOSC Data Commons Funding Acknowledgment */}
                        <div className="flex flex-col md:flex-row items-center md:items-center gap-2 mb-2">
                            <img
                                src={euLogo}
                                alt="European Union Flag"
                                className="h-6 w-auto"
                            />
                            <p className="text-xs font-light text-eosc-gray text-center md:text-right max-w-xs">
                                EOSC Data Commons is funded by the European Union <br className="hidden md:block"/>
                                Grant Agreement Number 101188179
                            </p>
                        </div>

                        <div className="flex items-center gap-4">
                            <a
                                target="_blank"
                                rel="noreferrer"
                                aria-label="linkedin"
                                title="LinkedIn Profile"
                                href="https://www.linkedin.com/company/eosc-data-commons/"
                                className="cursor-pointer hover:opacity-80 transition-opacity"
                            >
                                <FaLinkedin size={24} className="text-eosc-dark-blue"/>
                            </a>
                            <a
                                target="_blank"
                                rel="noreferrer"
                                aria-label="bluesky"
                                title="Bluesky Profile"
                                href="https://bsky.app/profile/eosc-data-commons.bsky.social"
                                className="cursor-pointer hover:opacity-80 transition-opacity"
                            >
                                <FaBluesky size={24} className="text-eosc-dark-blue"/>
                            </a>
                            <a
                                target="_blank"
                                rel="noreferrer"
                                href="mailto:eosc-data-commons-po@mailman.egi.eu"
                                aria-label="Mail"
                                title="Mail"
                                className="cursor-pointer hover:opacity-80 transition-opacity"
                            >
                                <MdEmail size={24} className="text-eosc-dark-blue"/>
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        </footer>
    );
};
