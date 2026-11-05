import {useNavigate} from "react-router";
import {useState} from "react";
import {MessageSquare} from "lucide-react";
import {SearchInput} from "../components/SearchInput";
import {Footer} from "../components/Footer";
import {EasterEgg} from "../components/EasterEgg";
import dataCommonsIconBlue from '@/assets/data-commons-icon-blue.svg';
import eoscLogo from '@/assets/logo-eosc-data-commons.svg';
import {useAuth} from "@/hooks/useAuth.ts";
import {UserMenu} from "@/components/UserMenu.tsx";
import {RepositoryStats} from "@/components/RepositoryStats.tsx";
import useMatomo from "@/hooks/useMatomo.ts";
import {type LandingTool, type SearchOrigin, trackLink} from "@/lib/analytics.ts";
import {loginWithReturn} from "@/lib/authRedirect.ts";

const ABOUT_URL = 'https://www.eosc-data-commons.eu/service/eosc-matchmaker';

// The example searches. `index` is what the report shows, so a reworded card keeps its row.
const dataCards: Array<{ index: '1' | '2' | '3'; query: string }> = [
    {index: '1', query: "Glucose level changes in the liver of individuals with type 1 diabetes from 1980 to 2020"},
    {index: '2', query: "Data about CO2 levels in europe between 1960 and 2020"},
    {index: '3', query: "Water quality Adriatic beaches Croatia 2015-2024"}
];

const toolCards: Array<{ tool: LandingTool; text: string; url: string }> = [
    {tool: 'galaxy', text: "Analyze biomedical data with Galaxy", url: "https://galaxyproject.org/"},
    {tool: 'jupyterlab', text: "JupyterLab", url: "https://jupyter.org/"},
    {tool: 'rstudio', text: "RStudio", url: "https://posit.co/products/open-source/rstudio/"}
];

export const LandingPage = () => {
    const navigate = useNavigate();
    const {user, loading, logout} = useAuth();
    const {trackEvent} = useMatomo();
    const [logoClickCount, setLogoClickCount] = useState(0);
    const [showEasterEgg, setShowEasterEgg] = useState(false);

    const handleLogoClick = () => {
        const newCount = logoClickCount + 1;
        setLogoClickCount(newCount);

        if (newCount === 5) {
            setShowEasterEgg(true);
            setLogoClickCount(0); // Reset counter
        }
    };

    const handleSearch = (query: string, model: string, aiMode?: boolean, origin: SearchOrigin = 'typed') => {
        if (aiMode) {
            // The chat page reports the question itself, with `source` as its origin.
            navigate('/chat', {state: {initialQuery: query, initialModel: model, source: 'landing'}});
        } else {
            trackEvent('Search', 'submitted', origin);
            navigate(`/search?q=${encodeURIComponent(query)}&model=${encodeURIComponent(model)}`);
        }
    };

    const handleExample = (card: typeof dataCards[number]) => {
        trackEvent('Landing', 'example_clicked', card.index);
        handleSearch(card.query, "cesnet/agentic", false, 'example');
    };

    const handleChat = () => {
        navigate('/chat');
    };

    // const handlePlay = (datasetHandle: string) => {
    //     const params = new URLSearchParams();
    //     params.set('datasetId', datasetHandle);
    //     let title = "";
    //     try {
    //         const url = new URL(datasetHandle);
    //         title = `A dataset from source: ${url}`;
    //     } catch {
    //         console.warn("Invalid URL:", datasetHandle);
    //     }
    //
    //     params.set('title', title);
    //     window.open(`/dataplayer?${params.toString()}`, '_blank');
    // };

    // window.open is invisible to Matomo's link tracking, so the outlink is reported by hand.
    const handleAbout = () => {
        trackEvent('Landing', 'about_clicked');
        trackLink(ABOUT_URL, 'link');
        window.open(ABOUT_URL, '_blank', 'noopener,noreferrer');
    };

    const handleTool = (card: typeof toolCards[number]) => {
        trackEvent('Landing', 'tool_card_clicked', card.tool);
        trackLink(card.url, 'link');
        window.open(card.url, '_blank', 'noopener,noreferrer');
    };

    const handleLogin = () => {
        loginWithReturn('header_landing');
    };

    return (
        <div className="min-h-screen bg-eosc-bg flex flex-col items-center px-4 relative">
            <EasterEgg active={showEasterEgg} onComplete={() => setShowEasterEgg(false)}/>
            <header className="w-full flex justify-between items-center p-4 sm:p-6">
                <img
                    src={dataCommonsIconBlue}
                    alt="EOSC"
                    className="w-16 h-9"
                />
                <div className="flex gap-4">
                    <button
                        onClick={handleAbout}
                        className="bg-white border border-eosc-border rounded-lg px-4 py-2 text-sm font-light text-eosc-text hover:bg-gray-50 hover:border-eosc-light-blue transition-colors cursor-pointer"
                    >
                        About
                    </button>
                    {user && (
                        <button
                            onClick={handleChat}
                            aria-label="Your conversations"
                            title="Your conversations"
                            className="inline-flex items-center bg-white border border-eosc-border rounded-lg px-3 sm:px-4 py-2 text-sm font-light text-eosc-text hover:bg-gray-50 hover:border-eosc-light-blue transition-colors cursor-pointer"
                        >
                            {/* Icon only on phones, where the label wraps and crowds the logo. */}
                            <MessageSquare className="h-5 w-5 sm:hidden"/>
                            <span className="hidden sm:inline">Your conversations</span>
                        </button>
                    )}
                    {!loading && (
                        user ? (
                            <UserMenu user={user} onLogout={logout} onProfile={() => navigate('/profile')}/>
                        ) : (
                            <button
                                onClick={handleLogin}
                                className="bg-white border border-eosc-border rounded-lg px-4 py-2 text-sm font-light text-eosc-text hover:bg-gray-50 hover:border-eosc-light-blue transition-colors cursor-pointer"
                            >
                                Login
                            </button>
                        )
                    )}
                </div>
            </header>

            <div className="w-full max-w-7xl mx-auto flex-grow flex flex-col justify-center">
                <div className="pt-6 pb-8 px-4 sm:px-0">
                    <div className="flex justify-center mt-8 sm:mt-16 mb-8">
                        <img
                            src={eoscLogo}
                            alt="EOSC Data Commons"
                            className="w-full max-w-lg h-auto cursor-pointer hover:opacity-90 active:opacity-80 transition-opacity select-none touch-manipulation"
                            onClick={handleLogoClick}
                            onTouchEnd={(e) => {
                                e.preventDefault();
                                handleLogoClick();
                            }}
                        />
                    </div>

                    {/* Subtitle */}
                    <div className="text-center mb-8">
                        <p className="text-xl sm:text-2xl font-light text-eosc-gray max-w-2xl mx-auto px-4">
                            Easily find high quality scientific datasets and deploy on tools using natural language
                        </p>
                    </div>

                    {/* Search Input */}
                    <div className="flex flex-col items-center px-4 space-y-4">
                        <SearchInput
                            onSearch={handleSearch}
                            className="w-full max-w-2xl"
                            isLoggedIn={!!user}
                            showAiToggle={true}
                        />

                        {/*<DataplayInput*/}
                        {/*    label="Play (tdb)"*/}
                        {/*    onPlay={handlePlay}*/}
                        {/*    className="w-full max-w-2xl"*/}
                        {/*/>*/}
                    </div>
                </div>

                {/* What can you discover section */}
                <div className="py-12">
                    <h2 className="text-2xl sm:text-3xl font-light text-eosc-text text-center mb-12">
                        What can you discover?
                    </h2>

                    <div className="max-w-7xl mx-auto px-4">
                        {/* Data Section */}
                        <div className="mb-12">
                            <h3 className="text-2xl sm:text-3xl font-light text-eosc-text text-left mb-8 ml-4">
                                Data
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {dataCards.map((card) => (
                                    <div
                                        key={card.index}
                                        onClick={() => handleExample(card)}
                                        className="bg-white border border-eosc-border rounded-xl p-6 min-h-[75px] flex items-center justify-center cursor-pointer hover:bg-gray-50 hover:border-eosc-light-blue transition-colors"
                                    >
                                        <p className="text-sm font-light text-black text-center">
                                            {card.query}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Statistics Section */}
                        <div className="mb-12">
                            <h3 className="text-2xl sm:text-3xl font-light text-eosc-text text-left mb-8 ml-4">
                                Dataset Statistics
                            </h3>
                            <div className="px-4">
                                <RepositoryStats/>
                            </div>
                        </div>

                        {/* Tools Section */}
                        <div className="mb-12">
                            <h3 className="text-2xl sm:text-3xl font-light text-eosc-text text-left mb-8 ml-4">
                                Tools
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {toolCards.map((card) => (
                                    <div
                                        key={card.tool}
                                        onClick={() => handleTool(card)}
                                        className="bg-white border border-eosc-border rounded-xl p-6 min-h-[75px] flex items-center justify-center cursor-pointer hover:bg-gray-50 hover:border-eosc-light-blue transition-colors"
                                    >
                                        <p className="text-sm font-light text-black text-center">
                                            {card.text}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <Footer/>
        </div>
    );
};

export default LandingPage;
