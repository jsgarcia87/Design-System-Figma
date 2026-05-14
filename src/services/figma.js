import axios from 'axios';

const FIGMA_API_BASE = 'https://api.figma.com/v1';

export const fetchFigmaFile = async (fileId, apiKey) => {
  try {
    const response = await axios.get(`${FIGMA_API_BASE}/files/${fileId}`, {
      headers: {
        'X-Figma-Token': apiKey,
      },
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching Figma file:', error);
    throw error;
  }
};

export const fetchFigmaStyles = async (fileId, apiKey) => {
  try {
    const response = await axios.get(`${FIGMA_API_BASE}/files/${fileId}/styles`, {
      headers: {
        'X-Figma-Token': apiKey,
      },
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching Figma styles:', error);
    throw error;
  }
};

export const fetchFigmaImages = async (fileId, ids, apiKey) => {
  try {
    const response = await axios.get(`${FIGMA_API_BASE}/images/${fileId}`, {
      params: {
        ids: ids.join(','),
        format: 'svg'
      },
      headers: {
        'X-Figma-Token': apiKey,
      },
    });
    return response.data.images;
  } catch (error) {
    console.error('Error fetching Figma images:', error);
    throw error;
  }
};

export const extractTokens = (figmaData) => {
  const tokens = {
    colors: [],
    typography: [],
    spacing: [],
    components: []
  };

  // Traverse the document to find styles and components
  const traverse = (node) => {
    // Extract Color from Fills if it's a solid color
    if (node.fills) {
      node.fills.forEach(fill => {
        if (fill.type === 'SOLID') {
          const color = {
            name: node.name || 'Unnamed',
            r: Math.round(fill.color.r * 255),
            g: Math.round(fill.color.g * 255),
            b: Math.round(fill.color.b * 255),
            a: fill.opacity !== undefined ? fill.opacity : 1,
            hex: rgbToHex(fill.color.r, fill.color.g, fill.color.b)
          };
          // Avoid duplicates
          if (!tokens.colors.find(c => c.hex === color.hex)) {
            tokens.colors.push(color);
          }
        }
      });
    }

    // Extract Typography
    if (node.type === 'TEXT' && node.style) {
      const textStyle = {
        name: node.name || 'Body',
        fontFamily: node.style.fontFamily,
        fontSize: node.style.fontSize,
        fontWeight: node.style.fontWeight,
        lineHeight: node.style.lineHeightPx,
        letterSpacing: node.style.letterSpacing,
      };
      // Simple check to group by unique style properties
      const styleId = `${textStyle.fontFamily}-${textStyle.fontSize}-${textStyle.fontWeight}`;
      if (!tokens.typography.find(t => `${t.fontFamily}-${t.fontSize}-${t.fontWeight}` === styleId)) {
        tokens.typography.push(textStyle);
      }
    }

    // Extract Components
    if (node.type === 'COMPONENT' || node.type === 'INSTANCE') {
      tokens.components.push({
        id: node.id,
        name: node.name,
        type: node.type
      });
    }

    if (node.children) {
      node.children.forEach(traverse);
    }
  };

  traverse(figmaData.document);
  return tokens;
};

const rgbToHex = (r, g, b) => {
  const toHex = (c) => {
    const hex = Math.round(c * 255).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
};
