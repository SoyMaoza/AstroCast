import React, { useEffect, useRef } from "react";
import "./History.css";


// Definición de los hitos (1980 - 2025)
const timelineEvents = [
    {
        year: "1980",
        stage: "Etapa 1",
        title: "Consolidación de la Observación Terrestre Satelital",
        description:
            "La NASA y otras agencias espaciales consolidan el uso de satélites, como la serie Landsat, para el monitoreo sistemático y a largo plazo de la superficie y atmósfera terrestre, sentando las bases para la climatología moderna.",
         image: "/assets/history/etapa-1.jpg" 
    },
    {
        year: "1987",
        stage: "Etapa 2",
        title: "Protocolo de Montreal",
        description:
            "Firma de un tratado internacional histórico diseñado para proteger la capa de ozono, eliminando progresivamente la producción de numerosas sustancias responsables de su agotamiento. Es considerado el acuerdo ambiental más exitoso hasta la fecha.",
        image: "/assets/history/etapa-2.jpg" 
    },
    {
        year: "1988",
        stage: "Etapa 3",
        title: "Creación del IPCC",
        description:
            "Se establece el Grupo Intergubernamental de Expertos sobre el Cambio Climático (IPCC) por la Organización Meteorológica Mundial (OMM) y el Programa de las Naciones Unidas para el Medio Ambiente (PNUMA) para proporcionar evaluaciones científicas integrales sobre el cambio climático.",
        image: "/assets/history/etapa-3.jpg" 
    },
    {
        year: "1997",
        stage: "Etapa 4",
        title: "Adopción del Protocolo de Kioto",
        description:
            "Se adopta un protocolo en el marco de la Convención Marco de las Naciones Unidas sobre el Cambio Climático (CMNUCC), comprometiendo a los países industrializados a limitar y reducir sus emisiones de gases de efecto invernadero (GEI).",
        image: "https://climate.nasa.gov/system/internal_resources/details/original/2936_kyoto.jpg"
    },
    {
        year: "1999",
        stage: "Etapa 5",
        title: "Lanzamiento del Satélite Terra (EOS AM-1)",
        description:
            "La NASA lanza Terra, el satélite insignia del Sistema de Observación de la Tierra (EOS), diseñado para monitorear el estado del medio ambiente de la Tierra y los cambios en su sistema climático. Sus instrumentos miden variables clave como la radiación, las nubes, los aerosoles y la cubierta terrestre.",
        image: "https://eospso.nasa.gov/sites/default/files/missions/Terra_1.jpeg"
    },
    {
        year: "2015",
        stage: "Etapa 6",
        title: "Firma del Acuerdo de París",
        description:
            "Un acuerdo histórico dentro de la CMNUCC que establece medidas para la reducción de las emisiones de GEI. Su objetivo es limitar el calentamiento global a muy por debajo de 2 °C, preferiblemente a 1.5 °C, en comparación con los niveles preindustriales.",
        image: "https://climate.nasa.gov/system/news_items/main_images/2715_paris.jpg"
    },
    {
        year: "2020",
        stage: "Etapa 7",
        title: "Hito en el Aumento de la Temperatura Global",
        description:
            "El año 2020 empata con 2016 como el año más cálido registrado, una clara evidencia de la tendencia de calentamiento a largo plazo. La década 2011-2020 fue la más cálida registrada, según datos de la NASA y la NOAA.",
        image: "https://climate.nasa.gov/system/news_items/main_images/2941_2020_temp.jpg"
    },
    {
        year: "2021",
        stage: "Etapa 8",
        title: "Publicación del Sexto Informe de Evaluación del IPCC (AR6)",
        description:
            "El IPCC publica la primera parte de su Sexto Informe de Evaluación, calificándolo como un 'código rojo para la humanidad'. El informe concluye de manera inequívoca que la influencia humana ha calentado la atmósfera, el océano y la tierra a un ritmo sin precedentes.",
        image: "https://climate.nasa.gov/system/news_items/main_images/3105_ar6-cover.jpg"
    },
    {
        year: "2025",
        stage: "Etapa 9",
        title: "AstroCast: Probabilidad y Datos de la NASA",
        description:
            "Lanzamiento de AstroCast en el NASA Space Apps Challenge, una aplicación que utiliza datos de observación de la Tierra para proporcionar análisis probabilísticos de condiciones climáticas, permitiendo a los usuarios tomar decisiones informadas.",
        image: "https://www.nasa.gov/sites/default/files/thumbnails/image/nasa-logo-web-rgb.png"
    }
];

const History = () => {
    const itemsRef = useRef([]);

    // Lógica para observar la visibilidad y aplicar la clase 'visible' (Animación)
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
            { threshold: 0.1 } // El elemento se considera visible cuando el 10% está en pantalla
        );

        itemsRef.current.forEach((item) => {
            if (item) observer.observe(item);
        });

        return () => observer.disconnect();
    }, []);

    return (
        <div className="history-container">
            <h1 className="history-title">Hitos en la Ciencia y Política Climática</h1>
            <p className="history-intro">
                Una cronología de los eventos clave que han definido nuestra comprensión del **cambio climático**
                y los avances en la **observación de la Tierra** por parte de la NASA.
            </p>

            <div className="timeline">
                {timelineEvents.map((event, index) => (
                    <div
                        key={index}
                        ref={(el) => (itemsRef.current[index] = el)}
                        className={`timeline-item ${index % 2 === 0 ? "left" : "right"}`}
                    >
                        <div className="timeline-content">
                            {/* NUEVO: Mostrar el número de etapa */}
                            <span className="timeline-stage">{event.stage}</span>
                            <h2>{event.year}</h2>
                            <h3>{event.title}</h3>
                            <p>{event.description}</p>
                            {/* Mostrar imagen solo si la URL está definida */}
                            {event.image && <img src={event.image} alt={event.title} loading="lazy" />}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default History;