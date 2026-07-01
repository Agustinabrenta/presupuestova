import { Redis } from '@upstash/redis';

// La integración de Redis (Upstash) del Marketplace de Vercel inyecta las
// credenciales como variables de entorno. Según cómo se llame la integración,
// pueden venir con prefijo KV_REST_API_* o UPSTASH_REDIS_REST_*.
// Contemplamos ambos para que funcione sin tocar nada.
const redis = new Redis({
  url: process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN,
});

// Clave única donde vive el historial compartido de toda la empresa
const KEY = 'va_historial';

export default async function handler(req, res) {
  try {
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
