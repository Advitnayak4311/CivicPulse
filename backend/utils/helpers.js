/**
 * Calculate the distance between two GPS coordinates in meters using the Haversine formula.
 */
function getDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // Earth radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in meters
}

/**
 * Generate a unique Complaint ID matching the format: CIV-YYYYMMDD-[5 RANDOM DIGITS]
 */
function generateComplaintId() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  
  const dateStr = `${year}${month}${day}`;
  const randomStr = Math.floor(10000 + Math.random() * 90000); // 5-digit number
  
  return `CIV-${dateStr}-${randomStr}`;
}

/**
 * Map Complaint Category to the designated Municipal Department Name
 */
function assignDepartment(category) {
  const cat = category.toLowerCase().trim();

  // Road Department
  if (cat.includes('road') || cat.includes('pothole') || cat.includes('footpath')) {
    return 'Road Department';
  }
  
  // Electrical Department
  if (cat.includes('light') || cat.includes('traffic signal') || cat.includes('streetlight')) {
    return 'Electrical Department';
  }
  
  // Drainage Department
  if (cat.includes('drainage') || cat.includes('sewage')) {
    return 'Drainage Department';
  }
  
  // Water Supply Department
  if (cat.includes('water')) {
    return 'Water Supply Department';
  }

  // Default: Sanitation Department for Garbage, Sanitation, Tree Fallen, Other, etc.
  return 'Sanitation Department';
}

/**
 * Local rule-based AI heuristic engine to automatically suggest category and priority.
 */
function suggestCategoryAndPriority(title, description) {
  const text = `${title} ${description}`.toLowerCase();
  let category = 'Other';
  let priority = 'Medium';

  // Category matching
  if (text.includes('pothole') || text.includes('cave-in') || text.includes('crater') || text.includes('footpath') || text.includes('sidewalk') || text.includes('road')) {
    category = 'Potholes';
  } else if (text.includes('light') || text.includes('dark') || text.includes('street-light') || text.includes('streetlight') || text.includes('bulb') || text.includes('electricity') || text.includes('spark')) {
    category = 'Street Light Failure';
  } else if (text.includes('drain') || text.includes('sewage') || text.includes('clog') || text.includes('overflow') || text.includes('sewer') || text.includes('drainage')) {
    category = 'Drainage Blockage';
  } else if (text.includes('water supply') || text.includes('drinking water') || text.includes('water leak') || text.includes('pipeline burst') || text.includes('no water')) {
    category = 'Water Supply Issue';
  } else if (text.includes('garbage') || text.includes('trash') || text.includes('waste') || text.includes('dump') || text.includes('litter') || text.includes('refuse')) {
    category = 'Garbage Overflow';
  } else if (text.includes('tree') || text.includes('branch') || text.includes('fallen tree')) {
    category = 'Tree Fallen';
  }

  // Priority matching (Escalation / Emergency triggers)
  if (
    text.includes('accident') ||
    text.includes('injured') ||
    text.includes('hospital') ||
    text.includes('danger') ||
    text.includes('hazard') ||
    text.includes('sparking') ||
    text.includes('live wire') ||
    text.includes('fire') ||
    text.includes('collapse') ||
    text.includes('blocking road') ||
    text.includes('flooding')
  ) {
    priority = 'Emergency';
  } else if (
    text.includes('severe') ||
    text.includes('broken') ||
    text.includes('risk') ||
    text.includes('disruptive') ||
    text.includes('terrible') ||
    text.includes('urgent')
  ) {
    priority = 'High';
  } else if (
    text.includes('minor') ||
    text.includes('low') ||
    text.includes('non-blocking') ||
    text.includes('cosmetic')
  ) {
    priority = 'Low';
  }

  return { category, priority };
}

module.exports = {
  getDistance,
  generateComplaintId,
  assignDepartment,
  suggestCategoryAndPriority
};
