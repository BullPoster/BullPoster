import React from 'react';

const ErrorPopup = ({ message }) => {
    return (
        <div className="error-popup">
            <p>{message}</p>
        </div>
    );
};

export default ErrorPopup;
