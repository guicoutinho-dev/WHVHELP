const CATEGORIES = Object.freeze([
  "Childcare",
  "Cleaning",
  "Construction",
  "Driving",
  "Farm",
  "Fruit Picking",
  "Hospitality",
  "Other",
  "Sales",
  "Trades",
  "Warehouse"
]);

const EMPLOYMENT_TYPES = Object.freeze([
  "casual",
  "part_time",
  "full_time",
  "seasonal",
  "contract"
]);

const PAY_PERIODS = Object.freeze([
  "hour",
  "day",
  "week",
  "year"
]);

const CATEGORY_MATCH_ORDER = Object.freeze([
  {
    category: "Fruit Picking",
    keywords: [
      "fruit pick",
      "berry pick",
      "blueberry",
      "strawberry",
      "raspberry",
      "cherry pick",
      "citrus pick",
      "apple pick",
      "grape pick",
      "mango pick",
      "avocado pick",
      "orchard picker",
      "orchard",
      "vineyard",
      "harvest picker",
      "pruning",
      "vineyard hand"
    ]
  },
  {
    category: "Childcare",
    keywords: [
      "childcare",
      "child care",
      "early childhood",
      "daycare",
      "nanny",
      "au pair",
      "oshc",
      "kindergarten",
      "nursery educator"
    ]
  },
  {
    category: "Cleaning",
    keywords: [
      "cleaner",
      "cleaning",
      "housekeeper",
      "housekeeping",
      "room attendant",
      "laundry attendant",
      "janitor",
      "car wash"
    ]
  },
  {
    category: "Farm",
    keywords: [
      "farm hand",
      "farmhand",
      "farm worker",
      "dairy farm",
      "cattle",
      "station hand",
      "livestock",
      "tractor",
      "agri",
      "poultry",
      "nursery hand",
      "horticultur",
      "Cotton",
      "grain harvest",
      "shed hand",
      "shearer",
      "rouseabout"
    ]
  },
  {
    category: "Construction",
    keywords: [
      "construction",
      "general labourer",
      "site labourer",
      "civil labourer",
      "scaffolder",
      "concreter",
      "formworker",
      "demolition",
      "traffic controller",
      "white card",
      "steel fixer",
      "bricklayer"
    ]
  },
  {
    category: "Trades",
    keywords: [
      "electrician",
      "plumber",
      "carpenter",
      "welder",
      "boilermaker",
      "mechanic",
      "diesel fitter",
      "fitter",
      "painter",
      "plasterer",
      "tiler",
      "cabinet maker",
      "glazier",
      "hvac",
      "refrigeration"
    ]
  },
  {
    category: "Warehouse",
    keywords: [
      "warehouse",
      "pick packer",
      "picker packer",
      "packing assistant",
      "forklift",
      "storeperson",
      "container unloader",
      "dispatch",
      "inventory",
      "freight handler",
      "logistics"
    ]
  },
  {
    category: "Driving",
    keywords: [
      "driver",
      "driving",
      "delivery",
      "courier",
      "truck",
      "mc driver",
      "hr driver",
      "mr driver",
      "chauffeur",
      "removalist"
    ]
  },
  {
    category: "Hospitality",
    keywords: [
      "barista",
      "waitstaff",
      "waiter",
      "waitress",
      "bartender",
      "bar staff",
      "bar support",
      "kitchen hand",
      "kitchen assistant",
      "dishwasher",
      "chef",
      "cook",
      "food runner",
      "cafe attendant",
      "cafe all rounder",
      "all rounder",
      "hospitality",
      "front of house",
      "guest service",
      "receptionist",
      "hostel",
      "hotel",
      "event crew",
      "catering"
    ]
  },
  {
    category: "Sales",
    keywords: [
      "sales assistant",
      "retail assistant",
      "store assistant",
      "cashier",
      "customer service",
      "fundraiser",
      "brand ambassador",
      "promotional",
      "telemarketing",
      "market staff",
      "merchandiser"
    ]
  }
]);

const CATEGORY_KEYWORDS = Object.freeze(
  Object.fromEntries(CATEGORY_MATCH_ORDER.map(entry => [entry.category, entry.keywords]))
);

module.exports = {
  CATEGORIES,
  CATEGORY_KEYWORDS,
  CATEGORY_MATCH_ORDER,
  EMPLOYMENT_TYPES,
  PAY_PERIODS
};
