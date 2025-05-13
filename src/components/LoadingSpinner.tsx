import React from 'react';

interface LoadingSpinnerProps {
    size?: number;
    className?: string;
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ size = 40, className = '' }) => {
    return (
        <div
            className={`animate-spin rounded-full border-t-2 border-b-2 border-blue-500 ${className}`}
            style={{ width: `${size}px`, height: `${size}px` }}
        />
    );
};

export default LoadingSpinner; 