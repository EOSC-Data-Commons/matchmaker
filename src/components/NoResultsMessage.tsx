import {BookIcon} from "lucide-react";

export const NoResultsMessage = () => {
    return (
        <div className="text-center py-12 bg-white/60 rounded-lg border border-dashed border-gray-300">
            <BookIcon className="h-12 w-12 text-gray-400 mx-auto mb-4"/>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No datasets found</h3>
            <p className="text-gray-600">Try adjusting your search terms or filters.</p>
        </div>
    );
};

