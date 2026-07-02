import { Redis } from '@upstash/redis';

// La integración de Redis (Upstash) del Marketplace de Vercel inyecta las
// credenciales como variables de entorno. Contemplamos ambos nombres posibles.
const redis = new Redis({
  url: process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN,
});

const KEY = 'va_historial';

// Clave de acceso compartida. Se define como variable de entorno en Vercel
// (Settings → Environment Variables → APP_PASSWORD). NO se escribe en el código.
const PASSWORD = process.env.APP_PASSWORD;

export default async function handler(req, res) {
  try {
    // ── Verificación de clave (server-side) ──
    // La app manda la clave en el header 'x-app-password' en cada pedido.
    if (!PASSWORD) {
      return res.status(500).json({ error: 'Falta configurar APP_PASSWORD en el servidor.' });
    }
    const provista = req.headers['x-app-password'];
    if (provista !== PASSWORD) {
      return res.status(401).json({ error: 'No autorizado' });
    }

    if (req.method === 'GET') {
      let data = (await redis.get(KEY)) || [];
      if (typeof data === 'string') { try { data = JSON.parse(data); } catch { data = []; } }
      return res.status(200).json(Array.isArray(data) ? data : []);
    }

    if (req.method === 'POST') {
      const nueva = req.body;
      if (!nueva || !nueva.nombre) {
        return res.status(400).json({ error: 'Faltan datos de la cotización.' });
      }
      let actual = (await redis.get(KEY)) || [];
      if (typeof actual === 'string') { try { actual = JSON.parse(actual); } catch { actual = []; } }
      if (!Array.isArray(actual)) actual = [];
      const item = { ...nueva, id: Date.now() };
      const actualizado = [item, ...actual];
      await redis.set(KEY, actualizado);
      return res.status(200).json(item);
    }

    if (req.method === 'DELETE') {
      const { id } = req.query;
      if (id) {
        let actual = (await redis.get(KEY)) || [];
        if (typeof actual === 'string') { try { actual = JSON.parse(actual); } catch { actual = []; } }
        if (!Array.isArray(actual)) actual = [];
        await redis.set(KEY, actual.filter(h => String(h.id) !== String(id)));
      } else {
        await redis.set(KEY, []);
      }
      return res.status(200).json({ ok: true });
    }

    res.setHeader('Allow', 'GET, POST, DELETE');
    return res.status(405).json({ error: 'Método no permitido' });
  } catch (e) {
    return res.status(500).json({ error: 'Error del servidor: ' + e.message });
  }
}
