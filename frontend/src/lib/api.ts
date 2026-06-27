const API_URL = process.env.NEXT_PUBLIC_API_URL;

export const fetchAPI = async (endpoint: string, options?: RequestInit) => {
  // 1. Extraemos los headers del resto de las opciones para separarlos
  const { headers, ...restOptions } = options || {};

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...restOptions, // 2. Ponemos el método y el body PRIMERO
    headers: {
      'Content-Type': 'application/json', // 3. Aseguramos el JSON
      ...headers,                         // 4. Inyectamos el Token de forma segura
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    let errorMessage = errorText;
    try {
      const errorJson = JSON.parse(errorText);
      errorMessage = errorJson.message || errorText;
    } catch (e) {
      // Si no es JSON, dejamos el texto plano
    }
    throw new Error(errorMessage);
  }

  return response.json();
};

export const parseImageUrls = (imageUrls: any): string[] => {
  if (!imageUrls) return [];
  if (Array.isArray(imageUrls)) return imageUrls;
  if (typeof imageUrls === "string") {
    const trimmed = imageUrls.trim();
    if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) return parsed;
      } catch (e) {
        // Ignore and treat as single string
      }
    }
    return [trimmed];
  }
  return [String(imageUrls)];
};