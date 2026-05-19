import React from 'react';

interface RepoLogoProps {
    repo: string;
}

const repoLogos: { [key: string]: { logo: string | null, name: string } } = {
    DANS: {logo: 'https://dans.knaw.nl/wp-content/uploads/2021/10/Logo-DANS.svg', name: 'DANS'},
    SWISS: {logo: 'https://www.swissubase.ch/swissubase.webp', name: 'SWISSUbase'},
    DABAR: {logo: 'https://dabar.srce.hr/img/dabar.svg', name: 'DABAR'},
    ONE: {logo: 'https://raw.githubusercontent.com/onedata/onedata/develop/resources/logo.png', name: 'Onedata'},
    HAL: {logo: 'https://about.hal.science/images/favicon.png', name: 'HAL Open Science'},
    PANOSC: {
        logo: 'https://www.panosc.eu/wp-content/uploads/2024/09/PaNOSClogo_print_RGB-2024-1024x480.png',
        name: 'PaNOSC'
    },
};

export const RepoLogo: React.FC<RepoLogoProps> = ({repo}) => {
    const repoInfo = repoLogos[repo.toUpperCase()];

    if (!repoInfo) {
        return (
            <span className="text-sm text-gray-600" title={`Harvested from: ${repo}`}>
                {repo}
            </span>
        );
    }

    return (
        <div className="flex items-center space-x-2" title={`Harvested from: ${repoInfo.name}`}>
            {repoInfo.logo ? (
                <img src={repoInfo.logo} alt={`${repoInfo.name} logo`} className="h-8 w-24 object-contain"/>
            ) : (
                <span className="text-sm text-gray-600">{repoInfo.name}</span>
            )}
        </div>
    );
};

