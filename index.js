const url = "https://cmr.earthdata.nasa.gov/search/collections.json?keyword=NLDAS Mosaic Land Surface Model L4 Hourly 0.125 x 0.125 degree V2.0 (NLDAS_MOS0125_H) at GES DISC";

fetch(url, {
  headers: {
    "Authorization": `Bearer ${token}`
  }
})
  .then(res => {
    if (!res.ok) {
      throw new Error(`Error HTTP: ${res.status}`);
    }
    return res.json();
  })
  .then(data => {
    console.log("Resultados de búsqueda:", data.feed.entry);
  })
  .catch(err => console.error("Error:", err));