import React, { useEffect, useRef, useState } from "react";
import "./History.css";

// Milestone definitions (1980 - 2025)
const timelineEvents = [
    {
        year: "1980",
        stage: "Phase 1",
        title: "Consolidation of Satellite Earth Observation",
        description:
            "NASA and other space agencies consolidated the use of satellites, such as the Landsat series, for the systematic and long-term monitoring of the Earth's surface and atmosphere, laying the foundation for modern climatology.",
        image: "/assets/history/etapa-1.jpg",
        context: {
            icon: "🛰️",
            text: "The dawn of the digital age and global satellite communication."
        }
    },
    {
        year: "1987",
        stage: "Phase 2",
        title: "Montreal Protocol",
        description:
            "Signing of a historic international treaty designed to protect the ozone layer by phasing out the production of numerous substances responsible for its depletion. It is considered the most successful environmental agreement to date.",
        image: "/assets/history/etapa-2.jpg",
        context: {
            icon: "🌍",
            text: "A growing global awareness of environmental issues emerges."
        }
    },
    {
        year: "1988",
        stage: "Phase 3",
        title: "Creation of the IPCC",
        description:
            "The Intergovernmental Panel on Climate Change (IPCC) is established by the World Meteorological Organization (WMO) and the United Nations Environment Programme (UNEP) to provide comprehensive scientific assessments on climate change.",
        image: "/assets/history/etapa-3.jpg",
        context: {
            icon: "🔬",
            text: "Scientific consensus on climate change begins to solidify."
        }
    },
    {
        year: "1997",
        stage: "Phase 4",
        title: "Adoption of the Kyoto Protocol",
        description:
            "A protocol is adopted under the United Nations Framework Convention on Climate Change (UNFCCC), committing industrialized countries to limit and reduce their greenhouse gas (GHG) emissions.",
        image: "/assets/history/etapa-4.jpg",
        context: {
            icon: "🏛️",
            text: "International policy starts to formally address GHG emissions."
        }
    },
    {
        year: "1999",
        stage: "Phase 5",
        title: "Launch of the Terra Satellite (EOS AM-1)",
        description:
            "NASA launches Terra, the flagship satellite of the Earth Observing System (EOS), designed to monitor the state of Earth's environment and changes in its climate system. Its instruments measure key variables such as radiation, clouds, aerosols, and land cover.",
        image: "/assets/history/etapa-5.jpeg",
        context: {
            icon: "📡",
            text: "Advanced Earth observation systems provide unprecedented data."
        }
    },
    {
        year: "2015",
        stage: "Phase 6",
        title: "Signing of the Paris Agreement",
        description:
            "A landmark agreement within the UNFCCC that establishes measures for the reduction of GHG emissions. Its goal is to limit global warming to well below 2°C, preferably to 1.5°C, compared to pre-industrial levels.",
        image: "/assets/history/etapa-6.jpg",
        context: {
            icon: "🤝",
            text: "A global commitment to a sustainable future is forged."
        }
    },
    {
        year: "2020",
        stage: "Phase 7",
        title: "Milestone in Global Temperature Rise",
        description:
            "The year 2020 ties with 2016 as the warmest year on record, clear evidence of the long-term warming trend. The decade 2011-2020 was the warmest recorded, according to data from NASA and NOAA.",
        image: "/assets/history/etapa-7.jpg",
        context: {
            icon: "🌡️",
            text: "The impacts of climate change become increasingly tangible."
        }
    },
    {
        year: "2021",
        stage: "Phase 8",
        title: "Publication of the IPCC Sixth Assessment Report (AR6)",
        description:
            "The IPCC releases the first part of its Sixth Assessment Report, calling it a 'code red for humanity.' The report unequivocally concludes that human influence has warmed the atmosphere, ocean, and land at an unprecedented rate.",
        image: "/assets/history/etapa-8.jpg",
        context: {
            icon: "❗",
            text: "The scientific community issues its most urgent warning yet."
        }
    },
    {
        year: "2025",
        stage: "Phase 9",
        title: "AstroCast: Probability and NASA Data",
        description:
            "Launch of AstroCast in the NASA Space Apps Challenge, an application that uses Earth observation data to provide probabilistic analyses of climate conditions, enabling users to make informed decisions.",
        image: "/assets/history/etapa9.webp",
        context: {
            icon: "🚀",
            text: "Data democratization empowers individuals to take action."
        }
    }
];

const History = () => {
    const itemsRef = useRef([]);
    const epilogueRef = useRef(null); // ✅ Add a ref for the conclusion

    // --- IMPROVEMENT: State to manage the expanded image in the modal ---
    const [expandedImage, setExpandedImage] = useState(null);

    // Logic to observe visibility and apply the 'visible' class (Animation)
    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        entry.target.classList.add("visible");
                        observer.unobserve(entry.target);
                    }
                });
            },
            { threshold: 0.1 } // The element is considered visible when 10% is on screen
        );

        itemsRef.current.forEach((item) => {
            if (item) observer.observe(item);
        });

        // ✅ We also observe the conclusion element
        if (epilogueRef.current) {
            observer.observe(epilogueRef.current);
        }

        return () => observer.disconnect();
    }, []);

    // --- IMPROVEMENT: Functions to handle the image modal ---
    const handleImageClick = (imageUrl) => {
        setExpandedImage(imageUrl);
    };

    const handleCloseModal = () => {
        setExpandedImage(null);
    };

    return (
        <div className="history-container">
            <h1 className="history-title">CLIMATE CHRONOLOGY: DECADES OF SCIENCE AND KEY AGREEMENTS</h1>
            <p className="history-intro">
                The timeline that changed everything. A journey through the crucial events that have shaped our understanding of climate change and the invaluable contribution of NASA's Earth observation.
            </p>
            
            {/* MAGNIFICENT PROLOGUE WITH NARRATIVE TRANSITION */}
            <div className="timeline-manifesto">
                <p>
                    In the early <strong>1980s</strong>, the global climate response was in its <strong>Era of Observation</strong>. Science, driven by systems like NASA's <strong>Earth observation</strong>, began to provide the <strong>undeniable data</strong> that quantified environmental damage and confirmed global warming.
                </p>
                <p>
                    This evidence marked the beginning of the <strong>Era of Commitment</strong>. This was solidified with the establishment of key institutions like the <strong>IPCC</strong> and the signing of crucial political treaties such as the Montreal and Kyoto Protocols, where science was directly translated into emission limits and national responsibility.
                </p>
                <p>
                    Finally, the <strong>Era of Universal Action</strong>, led by the <strong>Paris Agreement</strong>, united the global community around a 1.5°C target. The evolution culminates with current technology: projects like AstroCast that use <strong>NASA's space science</strong> to translate complex data into <strong>practical probabilities</strong>, empowering people to make informed decisions.
                </p>
                <p className="manifesto-closer">
                    Below, we present a timeline narrating this evolution through its <strong>most decisive milestones</strong>.
                </p>
            </div>
            
            <div className="timeline">
                {timelineEvents.map((event, index) => (
                    <div
                        key={index}
                        ref={(el) => (itemsRef.current[index] = el)}
                        className={`timeline-item ${index % 2 === 0 ? "left" : "right"}`}
                    >
                        <div className="timeline-content">
                            <span className="timeline-stage">{event.stage}</span>
                            <h2>{event.year}</h2>
                            <h3>{event.title}</h3>
                            <p>{event.description}</p>
                            {/* Show image only if the URL is defined */}
                            {event.image && (
                                <img 
                                    src={event.image} 
                                    alt={event.title} 
                                    loading="lazy" 
                                    onClick={() => handleImageClick(event.image)}
                                />
                            )}
                        </div>

                        {/* ✅ CONTEXT CAPSULE: Renders in the empty space */}
                        {event.context && (
                            <div className="timeline-context-box">
                                <span className="context-icon">{event.context.icon}</span>
                                <p>{event.context.text}</p>
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* --- ELEGANT CONCLUSION SECTION --- */}
            <div className="timeline-epilogue" ref={epilogueRef}>
                <h2>The Future is Now</h2>
                <p>
                    Climate history is not just a record of the past; it is the prologue to our future. Every piece of data, every mission, and every agreement has brought us here: a turning point where information becomes power.
                </p>
                <p>
                    With tools like <strong>AstroCast</strong>, the legacy of NASA's space science is in your hands. You are no longer a mere spectator, but an active participant, capable of anticipating, planning, and adapting.
                </p>
                <p className="epilogue-closer">
                    The next chapter of this story is written by you.
                </p>
            </div>

            {/* --- IMPROVEMENT: Modal for the expanded image --- */}
            {expandedImage && (
                <div className="image-modal-overlay" onClick={handleCloseModal}>
                    <button className="close-modal-btn" onClick={handleCloseModal}>&times;</button>
                    <div className="image-modal-content">
                        <img src={expandedImage} alt="Expanded view" className="expanded-image" />
                    </div>
                </div>
            )}

        </div>
    );
};

export default History;