/***********************
 * CONSTANTS
 ***********************/
const HEAVENLY_STEMS = ["甲", "乙", "丙", "丁", "戊", "己", "庚", "辛", "壬", "癸"];
const EARTHLY_BRANCHES = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"];

// Sectional terms that define the start of a Bazi month
const MONTHLY_SOLAR_TERMS = [
  "立春", "驚蟄", "清明", "立夏", "芒種", "小暑",
  "立秋", "白露", "寒露", "立冬", "大雪", "小寒"
];

const TERM_TO_BRANCH = {
  "立春": "寅", "驚蟄": "卯", "清明": "辰", "立夏": "巳", "芒種": "午", "小暑": "未",
  "立秋": "申", "白露": "酉", "寒露": "戌", "立冬": "亥", "大雪": "子", "小寒": "丑"
};

const HIDDEN_STEMS = {
  "子": ["癸"], "丑": ["己", "癸", "辛"], "寅": ["甲", "丙", "戊"], "卯": ["乙"],
  "辰": ["戊", "乙", "癸"], "巳": ["丙", "戊", "庚"], "午": ["丁", "己"],
  "未": ["己", "丁", "乙"], "申": ["庚", "壬", "戊"], "酉": ["辛"],
  "戌": ["戊", "辛", "丁"], "亥": ["壬", "甲"]
};

const HOUR_BRANCH_TABLE = [
  [23, 1, "子"], [1, 3, "丑"], [3, 5, "寅"], [5, 7, "卯"],
  [7, 9, "辰"], [9, 11, "巳"], [11, 13, "午"], [13, 15, "未"],
  [15, 17, "申"], [17, 19, "酉"], [19, 21, "戌"], [21, 23, "亥"]
];

// Reference point for Day Pillar (EST/UTC consistent)
const REF_DATE = new Date("2026-01-07T18:00:00");
const REF_DAY_PILLAR = "辛巳";

const mod = (n, m) => ((n % m) + m) % m;

/***********************
 * HELPERS
 ***********************/

/**
 * Searches backward to find the most recent monthly sectional term.
 * Skips "Zhongqi" like Winter Solstice.
 */
function resolveSectionalTerm(allDays, startIndex) {
  for (let i = startIndex; i >= 0; i--) {
    const term = allDays[i].solarTerm;
    if (term && MONTHLY_SOLAR_TERMS.includes(term)) {
      return {
        name: term,
        index: i,
        lunarYear: allDays[i].lunar.year
      };
    }
  }
  throw new Error("No valid monthly solar term found in JSON range.");
}

/***********************
 * PILLAR CALCULATIONS
 ***********************/

function getYearPillar(allDays, currentIndex) {
  let lastLichunIndex = -1;
  for (let i = currentIndex; i >= 0; i--) {
    if (allDays[i].solarTerm === "立春") {
      lastLichunIndex = i;
      break;
    }
  }
  // If Lichun is not found in the current window, fallback to the year of the active term
  if (lastLichunIndex === -1) {
    return resolveSectionalTerm(allDays, currentIndex).lunarYear;
  }
  return allDays[lastLichunIndex].lunar.year;
}

function getMonthPillar(yearPillar, termName) {
  const yearStem = yearPillar[0];
  const branch = TERM_TO_BRANCH[termName];
  
  // "Five Tigers" formula to find month stem
  const startMap = { "甲": "丙", "己": "丙", "乙": "戊", "庚": "戊", "丙": "庚", "辛": "庚", "丁": "壬", "壬": "壬", "戊": "甲", "癸": "甲" };
  const startStemIdx = HEAVENLY_STEMS.indexOf(startMap[yearStem]);
  const branchIdx = mod(EARTHLY_BRANCHES.indexOf(branch) - 2, 12); // Yin is month 0
  
  const stem = HEAVENLY_STEMS[mod(startStemIdx + branchIdx, 10)];
  return stem + branch;
}


/***********************
 * PILLAR CALCULATIONS
 ***********************/

/**
 * Calculates the Day Pillar.
 * Shifts to the next day's pillar at 23:00 (Start of Zi Hour).
 */
function getDayPillar(date) {
  const d = new Date(date);
  // BaZi day starts at 23:00
  if (d.getHours() >= 23) d.setDate(d.getDate() + 1);
  
  const diffDays = Math.floor((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - 
                   Date.UTC(REF_DATE.getFullYear(), REF_DATE.getMonth(), REF_DATE.getDate())) / 86400000);

  const stem = HEAVENLY_STEMS[mod(HEAVENLY_STEMS.indexOf(REF_DAY_PILLAR[0]) + diffDays, 10)];
  const branch = EARTHLY_BRANCHES[mod(EARTHLY_BRANCHES.indexOf(REF_DAY_PILLAR[1]) + diffDays, 12)];
  return stem + branch;
}

function getHourPillar(date, dayPillar) {
  const hour = date.getHours(); 
  const dayStem = dayPillar[0]; // This is already the shifted stem if hour >= 23
  let branch = "";

  // 1. Find the Branch
  for (const [start, end, b] of HOUR_BRANCH_TABLE) {
    if (start > end) { 
      if (hour >= start || hour < end) branch = b; 
    } else { 
      if (hour >= start && hour < end) branch = b; 
    }
  }

  // 2. Five Rats Formula (Calculated using the CURRENT dayStem)
  const startMap = { 
    "甲": "甲", "己": "甲", "乙": "丙", "庚": "丙", 
    "丙": "戊", "辛": "戊", "丁": "庚", "壬": "庚", 
    "戊": "壬", "癸": "壬" 
  };
  
  const startStemIdx = HEAVENLY_STEMS.indexOf(startMap[dayStem]);
  const branchIdx = EARTHLY_BRANCHES.indexOf(branch);
  const stem = HEAVENLY_STEMS[mod(startStemIdx + branchIdx, 10)];
  console.log("Stem", stem)
  return stem + branch;
}

/**
 * Main wrapper to calculate all 4 pillars.
 */
async function calculateBazi(date) {
  const year = date.getFullYear();
  const promises = [year - 1, year].map(y => fetch(`${y}.json`).then(r => r.json()).catch(() => []));
  const allDays = (await Promise.all(promises)).flat();

  const index = allDays.findIndex(d => 
    d.gregorian.year === year && 
    d.gregorian.month === date.getMonth() + 1 && 
    d.gregorian.date === date.getDate()
  );

  if (index === -1) throw new Error("Date not found in JSON data.");

  const termInfo = resolveSectionalTerm(allDays, index);
  
  const yearPillar = getYearPillar(allDays, index);
  const monthPillar = getMonthPillar(yearPillar, termInfo.name);
  
  // getDayPillar returns the pillar for the Bazi day (shifts at 23:00)
  const dayPillar = getDayPillar(date); 
  
  // getHourPillar now internally handles the stem correction for 23:00
  const hourPillar = getHourPillar(date, dayPillar);

  const pillars = [yearPillar, monthPillar, dayPillar, hourPillar];
  
  return {
    isoDate: date.toISOString(),
    pillars: pillars,
    activeTerm: termInfo.name,
    hiddenStems: pillars.map(p => HIDDEN_STEMS[p[1]].join(""))
  };
}