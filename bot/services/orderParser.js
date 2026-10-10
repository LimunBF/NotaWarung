import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load menu dari JSON
const menuPath = path.join(__dirname, '../../database/menu.json');
const menuData = JSON.parse(fs.readFileSync(menuPath, 'utf8'));

// Flatten menu untuk parsing
const allItems = [...menuData.makanan, ...menuData.minuman];

export function parseOrderText(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  const items = [];
  let customerName = null;
  let notes = null;
  let total = 0;

  for (const line of lines) {
    // Extract customer name: starts with "nama" or "pelanggan"
    const nameMatch = line.match(/^(?:nama|pelanggan)\s*[:=]\s*(.+)$/i);
    if (nameMatch) {
      customerName = nameMatch[1].trim();
      continue;
    }

    // Extract notes: starts with comment markers
    const noteMatch = line.match(/^(?:catatan|note|!)\s*[:=]?\s*(.+)$/i);
    if (noteMatch) {
      notes = noteMatch[1].trim();
      continue;
    }

    // Try parse as menu item
    const parsed = parseLine(line);
    if (parsed) {
      items.push(parsed);
      total += parsed.quantity * parsed.price;
    }
  }

  return { items, customerName, notes, total };
}

// Keep old export for backward compat
export { parseOrderText as parseOrderLegacy };

function parseLine(line) {
  // Pattern: "3 sate kambing" atau "sate kambing 3" atau "sate kambing x3"
  const patterns = [
    /^(\d+)\s+(.+)$/,           // "3 sate kambing"
    /^(.+?)\s+(\d+)$/,          // "sate kambing 3"
    /^(.+?)\s*x\s*(\d+)$/i,     // "sate kambing x3"
  ];

  for (const pattern of patterns) {
    const match = line.match(pattern);
    if (match) {
      let quantity, itemName;
      
      if (/^\d+/.test(match[1])) {
        // First capture is number
        quantity = parseInt(match[1]);
        itemName = match[2].toLowerCase().trim();
      } else {
        // First capture is item name
        itemName = match[1].toLowerCase().trim();
        quantity = parseInt(match[2]);
      }

      const menuItem = findMenuItem(itemName);
      if (menuItem) {
        return {
          name: menuItem.name,
          quantity,
          price: menuItem.price
        };
      }
    }
  }

  return null;
}

function findMenuItem(search) {
  const searchLower = search.toLowerCase();
  
  // Exact match di aliases
  for (const item of allItems) {
    if (item.aliases.some(alias => alias === searchLower)) {
      return item;
    }
  }

  // Partial match (includes)
  for (const item of allItems) {
    if (item.aliases.some(alias => 
      searchLower.includes(alias) || alias.includes(searchLower)
    )) {
      return item;
    }
  }

  return null;
}
