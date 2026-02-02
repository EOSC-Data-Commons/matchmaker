import {useState, useEffect, useRef} from 'react';
import {ChevronDown} from 'lucide-react';

interface ModelSelectorProps {
    models: string[];
    selectedModel: string;
    onModelChange: (model: string) => void;
}

const getShortName = (model: string) => {
    const parts = model.split('/');
    const modelName = parts[parts.length - 1];
    if (modelName.includes('mistral')) return 'Mistral';
    if (modelName.includes('gpt')) return 'GPT-4.1';
    if (modelName.includes('kimi')) return 'Kimi K2';
    if (modelName.includes('qwen')) return 'Qwen3';
    return modelName;
};

export const ModelSelector = ({models, selectedModel, onModelChange}: ModelSelectorProps) => {
    const [isOpen, setIsOpen] = useState(false);
    const selectorRef = useRef<HTMLDivElement>(null);

    const handleModelSelect = (model: string) => {
        onModelChange(model);
        setIsOpen(false);
    };

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (selectorRef.current && !selectorRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    return (
        <div className="relative w-full" ref={selectorRef}>
            <button
                type="button"
                className="w-full h-10 px-4 text-sm text-left text-eosc-gray font-light rounded-lg border border-eosc-border bg-white shadow-sm focus:outline-none flex items-center justify-between"
                onClick={() => setIsOpen(!isOpen)}
            >
                <span>{getShortName(selectedModel)}</span>
                <ChevronDown
                    className={`h-5 w-5 text-gray-400 transition-transform ${isOpen ? 'transform rotate-180' : ''}`}/>
            </button>
            {isOpen && (
                <div
                    className="absolute z-10 mt-1 w-full bg-white rounded-lg shadow-lg border border-eosc-border max-h-60 overflow-auto">
                    <ul className="py-1">
                        {models.map((model) => (
                            <li
                                key={model}
                                className="px-4 py-2 text-sm text-eosc-gray hover:bg-eosc-light-blue hover:text-blue-400 cursor-pointer"
                                onClick={() => handleModelSelect(model)}
                            >
                                {getShortName(model)}
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
};
