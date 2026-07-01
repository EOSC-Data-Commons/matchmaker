export const Pagination = ({page, size, total, onPageChange}: {
    page: number;
    size: number;
    total: number;
    onPageChange: (page: number) => void;
}) => {
    const totalPages = Math.ceil(total / size);
    if (totalPages <= 1) return null;

    const handlePageClick = (newPage: number) => {
        if (newPage >= 1 && newPage <= totalPages) {
            onPageChange(newPage);
        }
    };

    return (
        <div className="flex justify-center items-center gap-4 mt-8">
            <button
                onClick={() => handlePageClick(page - 1)}
                disabled={page === 1}
                className="px-4 py-2 bg-white border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
                Previous
            </button>
            <span className="text-sm text-gray-600">
                Page {page} of {totalPages.toLocaleString("en-GB")}
            </span>
            <button
                onClick={() => handlePageClick(page + 1)}
                disabled={page === totalPages}
                className="px-4 py-2 bg-white border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
                Next
            </button>
        </div>
    );
};
