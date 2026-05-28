import {useState} from "react";

interface DataplayInputProps {
    initialValue?: string;
    label: string;
    onPlay: (value: string) => void;
    loading?: boolean;
    placeholder?: string;
    className?: string;
}

export const DataplayInput = ({
                                  initialValue = '',
                                  label,
                                  onPlay,
                                  loading = false,
                                  placeholder = "Provide your dataset to play with, e.g. github, materials cloud.",
                                  className = "",
                              }: DataplayInputProps) => {
    const [value, setValue] = useState(initialValue);

    const handlePlay = (e: React.FormEvent) => {
        e.preventDefault();
        if (value.trim()) {
            onPlay(value.trim());
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handlePlay(e as unknown as React.FormEvent);
        }
    };

    return (
        <div className={`relative ${className}`}>
            <form onSubmit={handlePlay}>
                <div className="relative">
                    <input
                        type="text"
                        value={value}
                        onChange={(e) => setValue(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder={placeholder}
                        className={`truncate w-full h-16 px-4 text-lg text-eosc-gray font-light rounded-xl border-2 border-eosc-border bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-eosc-light-blue focus:border-eosc-light-blue pr-32`}
                    />
                    <button
                        type="submit"
                        disabled={loading}
                        className="absolute right-2 top-2 w-24 h-12 bg-green-500 text-white text-lg font-light rounded-lg hover:bg-green-600 transition-colors focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 cursor-pointer disabled:cursor-not-allowed"
                    >
                        {label}
                    </button>
                </div>
            </form>
        </div>
    );
};
