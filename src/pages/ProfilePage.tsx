import {useState} from "react";
import {useNavigate} from "react-router";
import {
    ArrowLeft,
    Check,
    Copy,
    ExternalLink,
    Eye,
    EyeOff,
    Info,
    KeyRound,
    Loader2,
    ShieldCheck,
    Trash2,
    User,
} from "lucide-react";
import {useAuth} from "@/hooks/useAuth.ts";
import {useApiKeys} from "@/hooks/useApiKeys.ts";
import {API_KEYS, type ApiKeyMeta} from "@/lib/apiKeys.ts";
import {getUserErrorMessage} from "@/lib/utils.ts";
import {Footer} from "@/components/Footer.tsx";
import dataCommonsIconBlue from '@/assets/data-commons-icon-blue.svg';

type CardStatus = { type: 'success' | 'error'; text: string } | null;

interface ApiKeyCardProps {
    meta: ApiKeyMeta;
    configured: boolean;
    disabled: boolean;
    onSave: (id: string, value: string) => Promise<void>;
    onRemove: (id: string) => Promise<void>;
    onReveal: (id: string) => Promise<string>;
}

const ApiKeyCard = ({meta, configured, disabled, onSave, onRemove, onReveal}: ApiKeyCardProps) => {
    const [value, setValue] = useState('');
    const [showInput, setShowInput] = useState(false);
    const [busy, setBusy] = useState<'idle' | 'saving' | 'removing'>('idle');
    const [status, setStatus] = useState<CardStatus>(null);
    const [revealed, setRevealed] = useState<string | null>(null);
    const [revealing, setRevealing] = useState(false);
    const [copied, setCopied] = useState(false);

    const handleSave = async () => {
        const trimmed = value.trim();
        if (!trimmed) return;
        setBusy('saving');
        setStatus(null);
        try {
            await onSave(meta.id, trimmed);
            setValue('');
            setShowInput(false);
            setStatus({type: 'success', text: 'Saved'});
        } catch (e) {
            setStatus({type: 'error', text: getUserErrorMessage(e)});
        } finally {
            setBusy('idle');
        }
    };

    const handleRemove = async () => {
        setBusy('removing');
        setStatus(null);
        try {
            await onRemove(meta.id);
            setRevealed(null);
            setStatus({type: 'success', text: 'Removed'});
        } catch (e) {
            setStatus({type: 'error', text: getUserErrorMessage(e)});
        } finally {
            setBusy('idle');
        }
    };

    const handleToggleReveal = async () => {
        if (revealed !== null) {
            setRevealed(null);
            return;
        }
        setRevealing(true);
        setStatus(null);
        try {
            setRevealed(await onReveal(meta.id));
        } catch (e) {
            setStatus({type: 'error', text: getUserErrorMessage(e)});
        } finally {
            setRevealing(false);
        }
    };

    const handleCopy = async () => {
        if (revealed === null) return;
        try {
            await navigator.clipboard.writeText(revealed);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        } catch {
            setStatus({type: 'error', text: 'Could not copy to clipboard.'});
        }
    };

    return (
        <div className="bg-eosc-card border border-eosc-border rounded-xl p-6">
            <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                    <div
                        className="w-10 h-10 rounded-lg bg-eosc-bg border border-eosc-border flex items-center justify-center shrink-0">
                        <KeyRound className="w-5 h-5 text-eosc-dark-blue"/>
                    </div>
                    <div>
                        <h3 className="text-base font-medium text-eosc-text">{meta.label}</h3>
                        <p className="text-sm text-eosc-gray mt-0.5">{meta.description}</p>
                        <a
                            href={meta.helpUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-eosc-light-blue hover:underline mt-1.5"
                        >
                            Where do I get this? <ExternalLink className="w-3 h-3"/>
                        </a>
                    </div>
                </div>
                {configured ? (
                    <span
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-green-700 bg-green-50 border border-green-200 rounded-full px-2.5 py-1 shrink-0">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500"/> Configured
                    </span>
                ) : (
                    <span
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-eosc-gray bg-eosc-bg border border-eosc-border rounded-full px-2.5 py-1 shrink-0">
                        <span className="w-1.5 h-1.5 rounded-full bg-gray-300"/> Not set
                    </span>
                )}
            </div>

            {configured && (
                <div className="mt-5">
                    <label className="block text-xs font-medium text-eosc-gray mb-1.5">Stored value</label>
                    <div className="flex items-center gap-2">
                        <input
                            type="text"
                            readOnly
                            value={revealed ?? '••••••••••••'}
                            className="flex-1 min-w-0 px-3 py-2 text-sm font-mono bg-eosc-bg border border-eosc-border rounded-lg text-eosc-text focus:outline-none"
                        />
                        <button
                            type="button"
                            onClick={handleToggleReveal}
                            disabled={disabled || revealing}
                            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm text-eosc-text border border-eosc-border rounded-lg hover:bg-gray-50 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {revealing ? <Loader2 className="w-4 h-4 animate-spin"/> : revealed !== null ?
                                <EyeOff className="w-4 h-4"/> : <Eye className="w-4 h-4"/>}
                            {revealed !== null ? 'Hide' : 'Show'}
                        </button>
                        {revealed !== null && (
                            <button
                                type="button"
                                onClick={handleCopy}
                                className="inline-flex items-center gap-1.5 px-3 py-2 text-sm text-eosc-text border border-eosc-border rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
                            >
                                {copied ? <Check className="w-4 h-4 text-green-600"/> : <Copy className="w-4 h-4"/>}
                                {copied ? 'Copied' : 'Copy'}
                            </button>
                        )}
                    </div>
                </div>
            )}

            <div className="mt-5">
                <label className="block text-xs font-medium text-eosc-gray mb-1.5">
                    {configured ? 'Replace key' : 'Set key'}
                </label>
                <div className="flex items-center gap-2">
                    <div className="relative flex-1 min-w-0">
                        <input
                            type={showInput ? 'text' : 'password'}
                            value={value}
                            onChange={(e) => setValue(e.target.value)}
                            placeholder={meta.placeholder}
                            disabled={disabled || busy !== 'idle'}
                            autoComplete="off"
                            spellCheck={false}
                            className="w-full px-3 py-2 pr-10 text-sm bg-white border border-eosc-border rounded-lg text-eosc-text placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-eosc-light-blue focus:border-transparent disabled:opacity-50"
                        />
                        <button
                            type="button"
                            onClick={() => setShowInput(s => !s)}
                            tabIndex={-1}
                            aria-label={showInput ? 'Hide input' : 'Show input'}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-eosc-text cursor-pointer"
                        >
                            {showInput ? <EyeOff className="w-4 h-4"/> : <Eye className="w-4 h-4"/>}
                        </button>
                    </div>
                    <button
                        type="button"
                        onClick={handleSave}
                        disabled={disabled || busy !== 'idle' || !value.trim()}
                        className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-eosc-dark-blue rounded-lg hover:bg-opacity-90 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {busy === 'saving' && <Loader2 className="w-4 h-4 animate-spin"/>}
                        Save
                    </button>
                </div>
            </div>

            <div className="mt-3 flex items-center justify-between min-h-[20px]">
                {status ? (
                    <p className={`text-sm ${status.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
                        {status.text}
                    </p>
                ) : <span/>}
                {configured && (
                    <button
                        type="button"
                        onClick={handleRemove}
                        disabled={disabled || busy !== 'idle'}
                        className="inline-flex items-center gap-1.5 text-sm text-red-600 hover:text-red-700 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {busy === 'removing' ? <Loader2 className="w-4 h-4 animate-spin"/> :
                            <Trash2 className="w-4 h-4"/>}
                        Remove
                    </button>
                )}
            </div>
        </div>
    );
};

export const ProfilePage = () => {
    const navigate = useNavigate();
    const {user, loading: userLoading} = useAuth();
    const {configured, loading: keysLoading, unavailable, error, save, remove, reveal, reload} =
        useApiKeys(!userLoading && !!user);

    return (
        <div className="min-h-screen bg-eosc-bg flex flex-col">
            {!userLoading && !user && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                    <div
                        className="bg-white rounded-xl shadow-xl max-w-md w-full p-8 text-center border border-gray-100">
                        <div
                            className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-5 shadow-sm">
                            <User className="h-8 w-8"/>
                        </div>
                        <h2 className="text-2xl font-semibold text-gray-900 mb-3">Authentication Required</h2>
                        <p className="text-gray-600 mb-8 leading-relaxed">
                            Please log in to your account to manage your API keys.
                        </p>
                        <div className="flex flex-col gap-3">
                            <button
                                onClick={() => window.location.href = '/auth/login'}
                                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg transition-colors shadow-sm cursor-pointer"
                            >
                                Log In to Continue
                            </button>
                            <button
                                onClick={() => navigate('/')}
                                className="w-full bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 font-medium py-3 px-4 rounded-lg transition-colors cursor-pointer"
                            >
                                Return to Home
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <header className="bg-white border-b border-eosc-border shrink-0 py-3 px-6 flex items-center">
                <img
                    src={dataCommonsIconBlue}
                    alt="EOSC Logo"
                    className="h-8 cursor-pointer hover:opacity-80 transition-opacity"
                    onClick={() => navigate('/')}
                />
            </header>

            <main className="flex-1 w-full max-w-2xl mx-auto px-4 py-10">
                <button
                    onClick={() => navigate('/')}
                    className="inline-flex items-center gap-1.5 text-sm text-eosc-gray hover:text-eosc-text mb-6 cursor-pointer"
                >
                    <ArrowLeft className="w-4 h-4"/> Back to home
                </button>

                <h1 className="text-2xl font-light text-eosc-text">API Keys</h1>
                <p className="text-eosc-gray mt-1">
                    Provide your own keys so the platform can act on your behalf. They are stored securely in the
                    EGI Secret Store and are only accessible to you.
                </p>

                <div
                    className="flex items-start gap-2 text-xs text-eosc-gray bg-eosc-bg border border-eosc-border rounded-lg px-3 py-2 mt-4">
                    <ShieldCheck className="w-4 h-4 mt-0.5 shrink-0 text-eosc-light-blue"/>
                    <span>Keys are write-only by default — reveal a stored value only when you need it.</span>
                </div>

                {unavailable && (
                    <div
                        className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 mt-6">
                        <Info className="w-5 h-5 text-amber-600 shrink-0 mt-0.5"/>
                        <div className="flex-1">
                            <p className="text-sm font-medium text-amber-800">Secret store unavailable</p>
                            <p className="text-sm text-amber-700 mt-0.5">
                                The EGI Secret Store can't be reached right now. You can still view this page, but
                                saving and reading keys is temporarily disabled.
                            </p>
                            <button
                                onClick={() => reload()}
                                className="text-sm font-medium text-amber-800 hover:underline mt-2 cursor-pointer"
                            >
                                Retry
                            </button>
                        </div>
                    </div>
                )}

                {error && !unavailable && (
                    <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 mt-6 text-sm text-red-700">
                        {error}
                    </div>
                )}

                {keysLoading && !unavailable ? (
                    <div className="flex items-center justify-center gap-2 text-eosc-gray py-16">
                        <Loader2 className="w-5 h-5 animate-spin"/> Loading…
                    </div>
                ) : (
                    <div className="space-y-5 mt-6">
                        {API_KEYS.map((meta) => (
                            <ApiKeyCard
                                key={meta.id}
                                meta={meta}
                                configured={configured.has(meta.id)}
                                disabled={unavailable}
                                onSave={save}
                                onRemove={remove}
                                onReveal={reveal}
                            />
                        ))}
                    </div>
                )}
            </main>

            <Footer/>
        </div>
    );
};

export default ProfilePage;
