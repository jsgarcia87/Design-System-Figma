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
    console.error('FIGMA_API_ERROR:', {
      status: error.response?.status,
      data: error.response?.data,
      message: error.message
    });
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

// Best-effort: the Variables read API requires an Enterprise org and a token
// with file_variables:read scope. On other plans Figma returns 403 — callers
// then silently fall back to named styles / raw fills.
export const fetchFigmaVariables = async (fileId, apiKey) => {
  try {
    const response = await axios.get(`${FIGMA_API_BASE}/files/${fileId}/variables/local`, {
      headers: {
        'X-Figma-Token': apiKey,
      },
    });
    return response.data && response.data.meta ? response.data.meta : null;
  } catch (error) {
    console.warn(
      'Figma Variables unavailable, using styles/fallback:',
      error.response?.status,
      error.response?.data?.message || error.message
    );
    return null;
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

const slugify = (s) =>
  String(s || 'unnamed')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '') || 'unnamed';

// Pushes extracted tokens into a Figma file as Variables via the REST Variables API.
// Note: writing variables requires an Enterprise org and a token with file_variables:write
// scope. On other plans Figma returns 403/404 — the caller surfaces that message verbatim.
export const pushTokensToFigma = async (fileId, apiKey, tokens) => {
  const COLL = 'tmp_collection';
  const MODE = 'tmp_mode';

  const variables = [];
  const variableModeValues = [];

  (tokens.colors || []).forEach((c, i) => {
    const id = `v_color_${i}`;
    variables.push({
      action: 'CREATE',
      id,
      name: `colors/${slugify(c.name)}`,
      variableCollectionId: COLL,
      resolvedType: 'COLOR',
    });
    variableModeValues.push({
      variableId: id,
      modeId: MODE,
      value: {
        r: (c.r ?? 0) / 255,
        g: (c.g ?? 0) / 255,
        b: (c.b ?? 0) / 255,
        a: c.a !== undefined ? c.a : 1,
      },
    });
  });

  (tokens.typography || []).forEach((t, i) => {
    const sizeId = `v_type_size_${i}`;
    variables.push({
      action: 'CREATE',
      id: sizeId,
      name: `typography/${slugify(t.name)}/size`,
      variableCollectionId: COLL,
      resolvedType: 'FLOAT',
    });
    variableModeValues.push({ variableId: sizeId, modeId: MODE, value: Number(t.fontSize) || 0 });

    if (t.fontFamily) {
      const famId = `v_type_family_${i}`;
      variables.push({
        action: 'CREATE',
        id: famId,
        name: `typography/${slugify(t.name)}/family`,
        variableCollectionId: COLL,
        resolvedType: 'STRING',
      });
      variableModeValues.push({ variableId: famId, modeId: MODE, value: String(t.fontFamily) });
    }
  });

  if (variables.length === 0) {
    throw new Error('No color or typography tokens available to push.');
  }

  const body = {
    variableCollections: [
      { action: 'CREATE', id: COLL, name: 'Design Tokens (FigmaTokens Pro)', initialModeId: MODE },
    ],
    variables,
    variableModeValues,
  };

  try {
    const response = await axios.post(`${FIGMA_API_BASE}/files/${fileId}/variables`, body, {
      headers: {
        'X-Figma-Token': apiKey,
        'Content-Type': 'application/json',
      },
    });
    return { data: response.data, count: variables.length };
  } catch (error) {
    console.error('FIGMA_PUSH_ERROR:', {
      status: error.response?.status,
      data: error.response?.data,
      message: error.message,
    });
    throw error;
  }
};

// Resolves tokens preferring real, named sources (Figma Variables, then named
// FILL/TEXT styles) and only falls back to raw fills/text when a file exposes
// no design tokens at all — so simple files and the demo still produce output.
export const extractTokens = (figmaData, variablesMeta = null) => {
  const tokens = {
    colors: [],
    typography: [],
    spacing: [],
    components: []
  };

  const addColor = (name, r, g, b, a, source) => {
    if (tokens.colors.some(c => c.name === name)) return;
    tokens.colors.push({
      name,
      r: Math.round(r * 255),
      g: Math.round(g * 255),
      b: Math.round(b * 255),
      a: a !== undefined ? a : 1,
      hex: rgbToHex(r, g, b),
      source
    });
  };

  // 1. Figma Variables — the modern, authoritative token source (when accessible)
  if (variablesMeta && variablesMeta.variables) {
    const collections = variablesMeta.variableCollections || {};
    Object.values(variablesMeta.variables).forEach(v => {
      if (v.remote) return;
      const collection = collections[v.variableCollectionId];
      const modeId = collection && collection.defaultModeId;
      const value = v.valuesByMode ? v.valuesByMode[modeId] : undefined;
      if (value === undefined || value === null) return;
      // Aliases point to other variables, not raw values — skip
      if (typeof value === 'object' && value.type === 'VARIABLE_ALIAS') return;

      if (v.resolvedType === 'COLOR' && typeof value === 'object' && 'r' in value) {
        addColor(v.name, value.r, value.g, value.b, value.a, 'variable');
      } else if (v.resolvedType === 'FLOAT' && typeof value === 'number') {
        if (!tokens.spacing.some(s => s.name === v.name)) {
          tokens.spacing.push({ name: v.name, value, source: 'variable' });
        }
      }
    });
  }

  // 2. Named styles (FILL / TEXT) referenced by nodes — human-named tokens
  const styleMeta = figmaData && figmaData.styles ? figmaData.styles : {};

  const traverse = (node) => {
    const fillStyleId = node.styles && (node.styles.fill || node.styles.fills);
    if (fillStyleId && styleMeta[fillStyleId] && styleMeta[fillStyleId].styleType === 'FILL' && node.fills) {
      const solid = node.fills.find(f => f.type === 'SOLID' && f.visible !== false);
      if (solid && solid.color) {
        addColor(styleMeta[fillStyleId].name, solid.color.r, solid.color.g, solid.color.b, solid.opacity, 'style');
      }
    }

    const textStyleId = node.styles && node.styles.text;
    if (textStyleId && styleMeta[textStyleId] && styleMeta[textStyleId].styleType === 'TEXT' && node.style) {
      const name = styleMeta[textStyleId].name;
      if (!tokens.typography.some(t => t.name === name)) {
        tokens.typography.push({
          name,
          fontFamily: node.style.fontFamily,
          fontSize: node.style.fontSize,
          fontWeight: node.style.fontWeight,
          lineHeight: node.style.lineHeightPx,
          letterSpacing: node.style.letterSpacing,
          source: 'style'
        });
      }
    }

    // Component definitions (not every instance, which would inflate the list)
    if (node.type === 'COMPONENT' || node.type === 'COMPONENT_SET') {
      if (!tokens.components.some(c => c.id === node.id)) {
        tokens.components.push({ id: node.id, name: node.name, type: node.type });
      }
    }

    if (node.children) node.children.forEach(traverse);
  };

  if (figmaData && figmaData.document) traverse(figmaData.document);

  // 3. Fallback — raw fills/text heuristic, only for what named sources missed
  const needColors = tokens.colors.length === 0;
  const needTypography = tokens.typography.length === 0;
  if ((needColors || needTypography) && figmaData && figmaData.document) {
    const seenHex = new Set(tokens.colors.map(c => c.hex));
    const legacy = (node) => {
      if (needColors && node.fills) {
        node.fills.forEach(fill => {
          if (fill.type === 'SOLID' && fill.color) {
            const hex = rgbToHex(fill.color.r, fill.color.g, fill.color.b);
            if (!seenHex.has(hex)) {
              seenHex.add(hex);
              tokens.colors.push({
                name: node.name || 'Unnamed',
                r: Math.round(fill.color.r * 255),
                g: Math.round(fill.color.g * 255),
                b: Math.round(fill.color.b * 255),
                a: fill.opacity !== undefined ? fill.opacity : 1,
                hex,
                source: 'fill'
              });
            }
          }
        });
      }
      if (needTypography && node.type === 'TEXT' && node.style) {
        const key = `${node.style.fontFamily}-${node.style.fontSize}-${node.style.fontWeight}`;
        if (!tokens.typography.some(t => `${t.fontFamily}-${t.fontSize}-${t.fontWeight}` === key)) {
          tokens.typography.push({
            name: node.name || 'Body',
            fontFamily: node.style.fontFamily,
            fontSize: node.style.fontSize,
            fontWeight: node.style.fontWeight,
            lineHeight: node.style.lineHeightPx,
            letterSpacing: node.style.letterSpacing,
            source: 'fill'
          });
        }
      }
      if (node.children) node.children.forEach(legacy);
    };
    legacy(figmaData.document);
  }

  return tokens;
};

const rgbToHex = (r, g, b) => {
  const toHex = (c) => {
    const hex = Math.round(c * 255).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
};
