import React from "react";
import "./CardComponent.css";

export default function CardComponent({
  imageSrc,
  title = "Título",
  subtitle = "Subtítulo",
  alt = "Imagen",
  href,
  onClick,
  className = "",
}) {
  const Wrapper = ({ children }) =>
    href ? (
      <a href={href} onClick={onClick} className={`card-wrapper ${className}`}>
        {children}
      </a>
    ) : (
      <div onClick={onClick} className={`card-wrapper ${className}`}>
        {children}
      </div>
    );

  return (
    <Wrapper>
      <div className="card-container">
        <div className="card-flex">
          {/* Imagen */}
          <div className="card-image">
            {imageSrc ? (
              <img
                src={imageSrc}
                alt={alt}
                className="card-img"
                loading="lazy"
              />
            ) : (
              <div className="card-img-placeholder">
                <svg xmlns="http://www.w3.org/2000/svg" className="placeholder-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3 7v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V7" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8 11l2 2 4-4 6 6" />
                </svg>
              </div>
            )}
          </div>

          {/* Contenido */}
          <div className="card-content">
            <h3 className="card-title">{title}</h3>
            <p className="card-subtitle">{subtitle}</p>

            <div className="card-button-wrapper">
              <button className="card-button">
                Ver más
              </button>
            </div>
          </div>
        </div>
      </div>
    </Wrapper>
  );
}
