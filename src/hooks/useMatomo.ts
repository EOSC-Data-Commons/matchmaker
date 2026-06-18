const useMatomo = () => {
    const trackEvent = (category: string, action: string, name?: string, value?: number) => {
        if (typeof window === 'undefined' || !window._paq) return;
        const cmd: Array<string | number> = ['trackEvent', category, action];
        if (name !== undefined) cmd.push(name);
        if (value !== undefined) cmd.push(value);
        window._paq.push(cmd);
    };
    return {trackEvent};
};

export default useMatomo;
