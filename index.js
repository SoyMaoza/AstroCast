const token = 'eyJ0eXAiOiJKV1QiLCJvcmlnaW4iOiJFYXJ0aGRhdGEgTG9naW4iLCJzaWciOiJlZGxqd3RwdWJrZXlfb3BzIiwiYWxnIjoiUlMyNTYifQ.eyJ0eXBlIjoiVXNlciIsInVpZCI6Imd1aWxsZXJtb3JhbW9zIiwiZXhwIjoxNzY0NTQ3MTk5LCJpYXQiOjE3NTkzMzk3NjcsImlzcyI6Imh0dHBzOi8vdXJzLmVhcnRoZGF0YS5uYXNhLmdvdiIsImlkZW50aXR5X3Byb3ZpZGVyIjoiZWRsX29wcyIsImFjciI6ImVkbCIsImFzc3VyYW5jZV9sZXZlbCI6M30.RAiWOvDVAYmcD4n8VRwyCupKpOjbhW0XcYzC6mENVhDf7rMk5ngzkjhrvYKPryqY9aPlVO_YpVKxplRz5zamwBjuQNipXbEOv6gWuo4hzHYkmqTAXyMnu-TQadyFoU-2g074ZPvzeTG2OFKLHKA1xK7vOn4sfJMZ_RBprSpiyKL4olm7n585ZWzl9ozwtGzRau-f-rHI4RRON-RQ-eG6Hyohj9dAdN_ipyAE6xjw7f2fjDR29WElfkVxjNT3AfSmVL1F532adIyB4F80KSL6KQ3UDeHdBdduUUQwDK8iLS1gw17PwVjjhMAa54p7SeTxW7tQFzdJZDh7gIyE3eT0Yw';

const url = "https://cmr.earthdata.nasa.gov/search/collections.json?keyword=NLDAS Mosaic Land Surface Model L4 Hourly 0.125 x 0.125 degree V2.0 (NLDAS_MOS0125_H) at GES DISC";
//"https://cmr.earthdata.nasa.gov/search/?qt=2019-09-04T00%3A00%3A00.000Z%2C2020-07-30T23%3A59%3A59.999Z"
//search?q=temperature&qt=2019-02-06T00%3A00%3A00.000Z%2C2020-02-04T23%3A59%3A59.999Z

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