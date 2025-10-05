import React, { useState, useEffect } from 'react';
import './Gauge.css';

const Gauge = ({ probability }) => {
    const [displayProbability, setDisplayProbability] = useState(0);
    const [rotation, setRotation] = useState(-90);

    useEffect(() => {
        const animationDuration = 1500; // 1.5 seconds
        const finalRotation = -90 + (probability / 100) * 180;

        // Animate the needle
        setRotation(finalRotation);

        // Animate the number "count-up"
        let startTimestamp = null;
        const step = (timestamp) => {
            if (!startTimestamp) startTimestamp = timestamp;
            const progress = Math.min((timestamp - startTimestamp) / animationDuration, 1);
            const currentNumber = Math.floor(progress * probability);
            setDisplayProbability(currentNumber);

            if (progress < 1) {
                window.requestAnimationFrame(step);
            } else {
                // Ensure the final number is exact
                setDisplayProbability(probability);
            }
        };

        window.requestAnimationFrame(step);

        // Cleanup function
        return () => {
            // Reset for next render if needed, though new props will trigger a new effect
            setDisplayProbability(0);
            setRotation(-90);
        };
    }, [probability]);

    return (
        <div className="gauge-container">
            <div className="gauge-body">
                <div className="gauge-fill"></div>
                <div className="gauge-needle" style={{ transform: `rotate(${rotation}deg)` }}></div>
                <div className="gauge-cover">
                    <span className="gauge-value">{displayProbability}%</span>
                </div>
            </div>
        </div>
    );
};

export default Gauge;