const { mapGmapsPlaceToRawEmployer } = require("./gmaps-employers");

function createGmapsAccommodationSource({ hubs = [], runScraper }) {
  return {
    id: "gmaps-accommodation",
    name: "Google Maps WHV Accommodation",
    async fetchAccommodations() {
      if (typeof runScraper !== "function") {
        throw new Error("runScraper function is required to execute accommodation queries");
      }
      const places = await runScraper(hubs);
      const list = Array.isArray(places) ? places : [];
      return list.map((place, idx) => mapGmapsPlaceToRawEmployer(place, idx));
    }
  };
}

module.exports = {
  createGmapsAccommodationSource
};
