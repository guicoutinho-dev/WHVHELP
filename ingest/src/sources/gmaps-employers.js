function slugify(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "place";
}

function mapGmapsPlaceToRawEmployer(place, index = 0) {
  const externalId =
    place?.place_id ||
    place?.cid ||
    `${slugify(place?.title || place?.name)}-${index}`;

  return {
    externalId: String(externalId),
    title: place?.title || place?.name || "",
    category: place?.category || null,
    categories: Array.isArray(place?.categories) ? place.categories : [],
    address: place?.address || null,
    phone: place?.phone || null,
    website: place?.web_site || place?.website || null,
    googleMapsUrl: place?.link || null,
    rating: typeof place?.review_rating === "number" ? place.review_rating : null,
    reviewCount: typeof place?.review_count === "number" ? place.review_count : null
  };
}

function createGmapsEmployersSource({ hubs = [], runScraper }) {
  return {
    id: "gmaps-employers",
    name: "Google Maps Regional Directory",
    async fetchEmployers() {
      if (typeof runScraper !== "function") {
        throw new Error("runScraper function is required to execute Google Maps queries");
      }
      const places = await runScraper(hubs);
      const list = Array.isArray(places) ? places : [];
      return list.map((place, idx) => mapGmapsPlaceToRawEmployer(place, idx));
    }
  };
}

module.exports = {
  createGmapsEmployersSource,
  mapGmapsPlaceToRawEmployer
};
