function slugify(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "place";
}

function parseGmapsScraperOutput(rawText) {
  if (typeof rawText !== "string" || !rawText.trim()) return [];
  const trimmed = rawText.trim();
  const collected = [];

  const pushValid = item => {
    if (item && typeof item === "object" && (item.title || item.name)) {
      collected.push(item);
    }
  };

  try {
    const whole = JSON.parse(trimmed);
    if (Array.isArray(whole)) {
      for (const el of whole) {
        if (Array.isArray(el)) el.forEach(pushValid);
        else pushValid(el);
      }
      return collected;
    }
  } catch {
    // NDJSON fallback below
  }

  for (const line of trimmed.split(/\r?\n/)) {
    const cleanLine = line.trim();
    if (!cleanLine || cleanLine === "null") continue;
    try {
      const parsed = JSON.parse(cleanLine);
      if (Array.isArray(parsed)) {
        parsed.forEach(pushValid);
      } else {
        pushValid(parsed);
      }
    } catch {
      // ignore non-JSON log lines
    }
  }

  return collected;
}

function mapGmapsPlaceToRawEmployer(place, index = 0) {
  const externalId =
    place?.place_id ||
    place?.data_id ||
    place?.cid ||
    place?.input_id ||
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
  mapGmapsPlaceToRawEmployer,
  parseGmapsScraperOutput
};
