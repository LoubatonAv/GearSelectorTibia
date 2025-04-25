import axios from "axios";
import * as cheerio from "cheerio";
import { writeFileSync, mkdirSync, existsSync, createWriteStream } from "fs";
import path from "path";
import { promisify } from "util";
import stream from "stream";

const pipeline = promisify(stream.pipeline);

// ============ CONFIGURATION OPTIONS ============
// To only download items with resistances/attributes, set this to true
// To download all items, set this to false
const FILTER_ITEMS_WITH_ATTRIBUTES = false;
// ==============================================

function ensureDirectoryExists(dirPath) {
  if (!existsSync(dirPath)) {
    mkdirSync(dirPath, { recursive: true });
  }
}

async function downloadImage(url, destPath) {
  if (!url) return false;

  try {
    if (url.startsWith("//")) {
      url = "https:" + url;
    }

    console.log(`Downloading image from: ${url}`);
    const response = await axios({
      method: "GET",
      url: url,
      responseType: "stream",
      timeout: 30000,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
      },
    });

    ensureDirectoryExists(path.dirname(destPath));
    await pipeline(response.data, createWriteStream(destPath));
    console.log(`✓ Successfully saved to ${destPath}`);
    return true;
  } catch (error) {
    console.error(`❌ Error downloading ${url}:`, error.message);
    return false;
  }
}

async function scrapeTable(url, category) {
  try {
    console.log(`Fetching page: ${url}`);
    const { data } = await axios.get(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
      },
    });

    const $ = cheerio.load(data);
    const items = [];
    const imagesDir = path.join(process.cwd(), "equipment-png", category);
    ensureDirectoryExists(imagesDir);

    const table = $("table.wikitable.full-width, table.wikitable.sortable, table.wikitable");
    if (!table.length) {
      console.warn(`⚠️ No suitable table found on ${url}`);
      return [];
    }

    let headers = [];
    const headerRow = table.find("tr").filter((i, el) => $(el).find("th").length > 0).first();
    if (headerRow.length) {
      const headerCells = headerRow.find("th");
      headerCells.each((i, th) => {
        const text = $(th).text().trim().toLowerCase().replace(/\s+/g, "_");
        headers.push(text || `header_${i + 1}`);
      });
      console.log(`Extracted headers from the first row (using th): ${headers.join(', ')}`);
    } else {
      console.warn("⚠️ No header row found.");
      return [];
    }

    table.find("tbody tr").each((index, element) => {
      const cells = $(element).find("td");
      console.log(`Row ${index + 1} has ${cells.length} cells`);
      if (cells.length >= headers.length - 1) {
        console.log(`→ Row ${index + 1} sample:`, $(element).text().slice(0, 100));

        const rowData = {};
        cells.each((i, cell) => {
          const header = headers[i];
          const cellText = $(cell).text().trim();
          rowData[header] = cellText;

          if (["item", "weapon", "name"].includes(header)) {
            const nameLink = $(cell).find("a").last();
            const name = nameLink.text().trim() || cellText;
            rowData["name"] = name;
          }
           else if (/lvl|level/.test(header)) {
            const value = parseInt(cellText, 10);
            rowData["required_level"] = isNaN(value) ? 0 : value;
          } else if (/resist/i.test(header)) {
            const resistances = {};
            const resistMatches = cellText.toLowerCase().match(/(fire|ice|energy|earth|death|holy|physical)\s*([+-]?\d+%?)/g);
            if (resistMatches) {
              resistMatches.forEach((entry) => {
                const matches = entry.match(/([a-z]+)\s*([+-]?\d+%?)/);
                if (matches && matches.length >= 3) {
                  const type = matches[1];
                  const val = matches[2];
                  resistances[type] = val;
                }
              });
            }
            if (Object.keys(resistances).length > 0) {
              rowData["resistances"] = resistances;
            }
          } else if (header.includes("vocation")) {
            rowData["required_vocation"] = cellText.toLowerCase();
            rowData["vocation"] = cellText.toLowerCase();
          } else if (header.includes("weight")) {
            const weight = parseFloat(cellText.replace(",", "."));
            rowData["weight"] = isNaN(weight) ? 0.00 : Number(weight.toFixed(2));
          } else if (header.includes("imb._slots") || header.includes("imbue_slots")) {
            const value = parseInt(cellText, 10);
            if (!isNaN(value)) {
              rowData["imbue_slots"] = { total: value, filled: 0 };
            }
          } else if (header === "attributes") {
            const attributesArray = [];
            const augments = {};

            // Split augments from attributes
            const [attrsPart, augmentsPart] = cellText.split(/augments:/i);

            // Attributes
            if (attrsPart) {
              const attrMatches = attrsPart.match(/([\w\s]+?)\s*\+(\d+%?)/g);
              if (attrMatches) {
                attrMatches.forEach(attr => {
                  const match = attr.match(/([\w\s]+?)\s*\+(\d+%?)/);
                  if (match) {
                    attributesArray.push({
                      name: match[1].trim().toLowerCase().replace(/ /g, "_"),
                      value: `+${match[2].trim()}`
                    });
                  }
                });
              }
            }

            // Augments
            if (augmentsPart) {
              augmentsPart.split(",").forEach(entry => {
                const match = entry.trim().match(/(.+?)\s*->\s*(\+\d+%.*)/);
                if (match) {
                  augments[match[1].trim()] = match[2].trim();
                }
              });
            }

            if (attributesArray.length > 0) rowData["attributes"] = attributesArray;
            if (Object.keys(augments).length > 0) rowData["augments"] = augments;
          }
        });

        if (rowData.name) {
          console.log(`✅ Parsed item: ${rowData.name}`);

          rowData["equipmentType"] = category.replace(/_/g, " ");
          items.push(rowData);
        }
      }
    });

    console.log(`Number of items extracted: ${items.length}`);
    return items;
  } catch (err) {
    console.error(`Error scraping ${url}:`, err.message);
    return [];
  }
}


async function getItemDetails(itemName, category) {
  try {
    const formattedName = encodeURIComponent(itemName.replace(/ /g, "_"));
    const url = `https://tibia.fandom.com/wiki/${formattedName}`;
    console.log(`Fetching details for ${itemName} from ${url}`);

    const { data } = await axios.get(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
      },
      timeout: 10000,
    });

    const $ = cheerio.load(data);
    const details = {}; // Initialize as an empty object

    const image = $(".infobox img, .infoboxtable img").first();
    let imageUrl = image.attr("src") || image.attr("data-src");
    if (imageUrl) {
      if (imageUrl.startsWith("//")) imageUrl = `https:${imageUrl}`;
      if (imageUrl.startsWith("/")) imageUrl = `https://tibia.fandom.com${imageUrl}`;
      details.image_url = imageUrl;

      const safeFileName = itemName.replace(/[^a-z0-9]/gi, "_").toLowerCase();
      details.local_image = `/equipment-png/${category}/${safeFileName}.png`;
    }

    const weightText = $("body").text().match(/weight:?\s*([\d,.]+)\s*oz/i);
    if (weightText && weightText[1]) {
      details.weight = parseFloat(weightText[1].replace(",", "."));
    }

    const imbueMatch = $("body").text().match(/(\d+)\s+imbue\s+slots?/i);
    if (imbueMatch) {
      details.imbue_slots = {
        total: parseInt(imbueMatch[1], 10),
        filled: 0
      };
    }

    const rangeMatchDetails = $("body").text().match(/range:\s*(\d+)/i);
    if (rangeMatchDetails) {
      details.range = parseInt(rangeMatchDetails[1], 10);
    }

    const attributesArray = [];

    const magicLevelMatch = $("body").text().match(/magic\s+level\s+\+(\d+)/i);
    if (magicLevelMatch) attributesArray.push({ name: "magic_level", value: parseInt(magicLevelMatch[1], 10) });

    const elementalTypes = ["fire", "ice", "energy", "earth"];
    elementalTypes.forEach(element => {
      const elementalMatch = $("body").text().match(new RegExp(`${element}\\s+magic\\s+level\\s+\\+(\\d+)`, "i"));
      if (elementalMatch) attributesArray.push({ name: `${element}_magic_level`, value: parseInt(elementalMatch[1], 10) });
    });

    const critChanceMatch = $("body").text().match(/critical\s+hit\s+chance\s+\+?(\d+%)/i);
    if (critChanceMatch) attributesArray.push({ name: "critical_hit_chance", value: critChanceMatch[1] });

    const critDamageMatch = $("body").text().match(/critical\s+extra\s+damage\s+(\+\d+%)/i);
    if (critDamageMatch) attributesArray.push({ name: "critical_extra_damage", value: critDamageMatch[1] });

    const lifeLeechMatch = $("body").text().match(/life\s+leech\s+(\+\d+%)/i);
    if (lifeLeechMatch) attributesArray.push({ name: "life_leech", value: lifeLeechMatch[1] });

    const manaLeechMatch = $("body").text().match(/mana\s+leech\s+(\+\d+%)/i);
    if (manaLeechMatch) attributesArray.push({ name: "mana_leech", value: manaLeechMatch[1] });

    const augmentBlock = $("body").text().match(/augments:\s*([^\n.]+)/i);
    if (augmentBlock && augmentBlock[1]) {
  const augmentText = augmentBlock[1];
  const augments = {};
  const matches = augmentText.split(",").map(s => s.trim());
  matches.forEach((entry) => {
    const parts = entry.match(/(.+?)\s*->\s*(\+\d+%.*)/);
    if (parts && parts.length >= 3) {
      const name = parts[1].trim();
      const value = parts[2].trim();
      augments[name] = value;
    }
  });
  if (Object.keys(augments).length) details.augments = augments;
}


    const spellBonusMatches = $("body").text().match(/([A-Za-z'\s]+)\s+(\+\d+%)\s+base\s+damage/gi);
    if (spellBonusMatches) {
      spellBonusMatches.forEach(match => {
        const parts = match.match(/([A-Za-z'\s]+?)\s+(\+\d+%)\s+base\s+damage/i);
        if (parts && parts.length >= 3) {
          attributesArray.push({ name: `${parts[1].trim()}_base_damage`, value: `${parts[2]} base damage` });
        }
      });
    }

    const resistanceTypes = ["fire", "ice", "energy", "earth", "death", "holy", "physical"];
    resistanceTypes.forEach(type => {
      const resistanceMatch = $("body").text().match(new RegExp(`${type}\\s+([+-]\\d+%?)`, "i"));
      if (resistanceMatch) attributesArray.push({ name: `${type}_resistance`, value: resistanceMatch[1] });
    });

    if (attributesArray.length > 0) details.attributes = attributesArray;

    return details;
  } catch (err) {
    console.error(`Error fetching details for ${itemName}:`, err.message);
    return {};
  }
}

function mergeItemWithDetails(item, details, category) {
  const result = {
    ...item, // Start with all properties from the scraped item
    ...details, // Overwrite with details where available
    equipmentType: item.equipmentType,
    vocation: item.vocation,
  };

  // Ensure local_image is correctly constructed if not present or incorrect
  // Ensure local_image is correctly constructed if not present or incorrect
  if (!result.local_image && result.name && category) {
    const safeFileName = result.name.replace(/[^a-z0-9]/gi, "_").toLowerCase();
    result.local_image = `/equipment-png/${category}/${safeFileName}.png`;

  }

  return result;
}

/**
 * Checks if an item has attributes like resistances, buffs, or other special properties
 * @param {Object} item - The item to check
 * @returns {boolean} - True if the item has attributes, false otherwise
 */
function itemHasAttributes(item) {
  // Return true if the attributes array has any elements
  return (item.attributes && item.attributes.length > 0) ||
         (item.imbue_slots && item.imbue_slots.total > 0) ||
         (item.range && item.range > 0);
}

(async () => {
  const categories = [
    // { name: "wands", url: "https://tibia.fandom.com/wiki/Wands"},
    // { name: "armors", url: "https://tibia.fandom.com/wiki/Armors"},
    // { name: "boots", url: "https://tibia.fandom.com/wiki/Boots"},
    // { name: "bows", url: "https://tibia.fandom.com/wiki/Bows"},
    // { name: "clubs", url: "https://tibia.fandom.com/wiki/Club_Weapons"},
    // { name: "helmets", url: "https://tibia.fandom.com/wiki/Helmets"},
    // { name: "legs", url: "https://tibia.fandom.com/wiki/Legs"},
    // { name: "rods", url: "https://tibia.fandom.com/wiki/Rods"},
    // { name: "spellbooks", url: "https://tibia.fandom.com/wiki/Spellbooks"},
    // { name: "swords", url: "https://tibia.fandom.com/wiki/Sword_Weapons"},
    // { name: "wands", url: "https://tibia.fandom.com/wiki/Wands"},
    { name: "axes", url: "https://tibia.fandom.com/wiki/Axe_Weapons"},

    // Add other categories as needed
  ];

  for (const { name, url } of categories) {
    console.log(`\n📊 Scraping ${name} from ${url}...`);
    ensureDirectoryExists(path.join(process.cwd(), "equipment-png", name));

    const equipmentData = await scrapeTable(url, name);
    if (!equipmentData.length) {
      console.warn(`No equipment data found for ${name}`);
      continue;
    }

    console.log(`Found ${equipmentData.length} items for ${name}`);

    console.log("🔍 Fetching additional details for each item...");
    const enhancedEquipmentData = [];

    for (let i = 0; i < equipmentData.length; i++) {
      const item = equipmentData[i];
      const countText = `[${i + 1}/${equipmentData.length}]`;
      console.log(`🔍 ${countText} Processing: ${item.name}`);
    
      try {
        const additionalDetails = await getItemDetails(item.name, name);
        const enhancedItem = mergeItemWithDetails(item, additionalDetails, name);
    
        if (!FILTER_ITEMS_WITH_ATTRIBUTES || itemHasAttributes(enhancedItem)) {
          enhancedEquipmentData.push(enhancedItem);
          console.log(`✅ ${countText} Done: ${item.name}`);
        } else {
          console.log(`⚠️ ${countText} Skipped (no attributes): ${item.name}`);
        }
      } catch (err) {
        console.log(`❌ ${countText} Error processing ${item.name}: ${err.message}`);
      }
    
      await new Promise(resolve => setTimeout(resolve, 500)); // Sleep between requests
    }
    

    console.log(`📊 Filtered to ${enhancedEquipmentData.length} items with attributes (from ${equipmentData.length} total)`);

    // console.log("📥 Downloading images...");
    // let count = 0;
    // for (const item of enhancedEquipmentData) {
    //   if (item.image_url && item.local_image) {
    //     const fileName = item.local_image.split("/").pop();
    //     const fullPath = path.join("equipment-png", name, fileName);
    //     const ok = await downloadImage(item.image_url, fullPath);
    //     if (ok) count++;
    //   }
    // }
    // console.log(`✅ ${count}/${enhancedEquipmentData.length} images downloaded.`);

    const outputPath = path.join(process.cwd(), `${name}.json`);
    writeFileSync(outputPath, JSON.stringify(enhancedEquipmentData, null, 2));
    console.log(`💾 Saved ${name}.json with ${enhancedEquipmentData.length} items`);
  }
})();