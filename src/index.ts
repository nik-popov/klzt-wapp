import { Hono } from "hono";
import { cors } from "hono/cors";
import { serveStatic } from "hono/cloudflare-workers";

export interface Env {
  DB: D1Database;
  BUCKET: R2Bucket;
}

const app = new Hono<{ Bindings: Env }>();

// CORS for local development
app.use("/api/*", cors());

// ─── Categories ──────────────────────────────────────────────────────────────

app.get("/api/categories", async (c) => {
  const { results } = await c.env.DB.prepare(
    "SELECT * FROM categories ORDER BY name"
  ).all();
  return c.json(results);
});

app.post("/api/categories", async (c) => {
  const { name } = await c.req.json<{ name: string }>();
  if (!name?.trim()) {
    return c.json({ error: "Category name is required" }, 400);
  }
  const result = await c.env.DB.prepare(
    "INSERT INTO categories (name) VALUES (?) RETURNING *"
  )
    .bind(name.trim())
    .first();
  return c.json(result, 201);
});

app.delete("/api/categories/:id", async (c) => {
  const id = Number(c.req.param("id"));
  await c.env.DB.prepare("DELETE FROM categories WHERE id = ?").bind(id).run();
  return c.json({ success: true });
});

// ─── Items ────────────────────────────────────────────────────────────────────

app.get("/api/items", async (c) => {
  const { results } = await c.env.DB.prepare(`
    SELECT i.*, c.name AS category_name
    FROM items i
    LEFT JOIN categories c ON c.id = i.category_id
    ORDER BY i.created_at DESC
  `).all();
  return c.json(results);
});

app.get("/api/items/:id", async (c) => {
  const id = Number(c.req.param("id"));
  const item = await c.env.DB.prepare(`
    SELECT i.*, c.name AS category_name
    FROM items i
    LEFT JOIN categories c ON c.id = i.category_id
    WHERE i.id = ?
  `)
    .bind(id)
    .first();
  if (!item) return c.json({ error: "Item not found" }, 404);
  return c.json(item);
});

app.post("/api/items", async (c) => {
  const body = await c.req.json<{
    name: string;
    description?: string;
    category_id?: number;
    color?: string;
    size?: string;
    brand?: string;
  }>();

  if (!body.name?.trim()) {
    return c.json({ error: "Item name is required" }, 400);
  }

  const result = await c.env.DB.prepare(`
    INSERT INTO items (name, description, category_id, color, size, brand)
    VALUES (?, ?, ?, ?, ?, ?)
    RETURNING *
  `)
    .bind(
      body.name.trim(),
      body.description ?? null,
      body.category_id ?? null,
      body.color ?? null,
      body.size ?? null,
      body.brand ?? null
    )
    .first();

  return c.json(result, 201);
});

app.put("/api/items/:id", async (c) => {
  const id = Number(c.req.param("id"));
  const body = await c.req.json<{
    name?: string;
    description?: string;
    category_id?: number | null;
    color?: string;
    size?: string;
    brand?: string;
  }>();

  const existing = await c.env.DB.prepare(
    "SELECT * FROM items WHERE id = ?"
  )
    .bind(id)
    .first<{
      name: string;
      description: string | null;
      category_id: number | null;
      color: string | null;
      size: string | null;
      brand: string | null;
    }>();

  if (!existing) return c.json({ error: "Item not found" }, 404);

  const result = await c.env.DB.prepare(`
    UPDATE items
    SET name = ?, description = ?, category_id = ?, color = ?, size = ?, brand = ?,
        updated_at = datetime('now')
    WHERE id = ?
    RETURNING *
  `)
    .bind(
      body.name ?? existing.name,
      body.description ?? existing.description,
      "category_id" in body ? (body.category_id ?? null) : existing.category_id,
      body.color ?? existing.color,
      body.size ?? existing.size,
      body.brand ?? existing.brand,
      id
    )
    .first();

  return c.json(result);
});

app.delete("/api/items/:id", async (c) => {
  const id = Number(c.req.param("id"));
  const item = await c.env.DB.prepare(
    "SELECT image_key FROM items WHERE id = ?"
  )
    .bind(id)
    .first<{ image_key: string | null }>();

  if (item?.image_key) {
    await c.env.BUCKET.delete(item.image_key);
  }

  await c.env.DB.prepare("DELETE FROM items WHERE id = ?").bind(id).run();
  return c.json({ success: true });
});

// Mark item as worn today
app.post("/api/items/:id/wear", async (c) => {
  const id = Number(c.req.param("id"));
  const result = await c.env.DB.prepare(`
    UPDATE items
    SET times_worn = times_worn + 1,
        last_worn  = date('now'),
        updated_at = datetime('now')
    WHERE id = ?
    RETURNING *
  `)
    .bind(id)
    .first();
  if (!result) return c.json({ error: "Item not found" }, 404);
  return c.json(result);
});

// ─── Image upload / delete ────────────────────────────────────────────────────

app.post("/api/items/:id/image", async (c) => {
  const id = Number(c.req.param("id"));

  const item = await c.env.DB.prepare(
    "SELECT image_key FROM items WHERE id = ?"
  )
    .bind(id)
    .first<{ image_key: string | null }>();

  if (item === null) return c.json({ error: "Item not found" }, 404);

  const formData = await c.req.formData();
  const file = formData.get("image");
  if (!(file instanceof File)) {
    return c.json({ error: "image field is required" }, 400);
  }

  if (item.image_key) {
    await c.env.BUCKET.delete(item.image_key);
  }

  const key = `items/${id}/${Date.now()}-${file.name}`;
  await c.env.BUCKET.put(key, file.stream(), {
    httpMetadata: { contentType: file.type },
  });

  await c.env.DB.prepare(
    "UPDATE items SET image_key = ?, updated_at = datetime('now') WHERE id = ?"
  )
    .bind(key, id)
    .run();

  return c.json({ image_key: key });
});

app.get("/api/images/:key{.+}", async (c) => {
  const key = c.req.param("key");
  const object = await c.env.BUCKET.get(key);
  if (!object) return c.json({ error: "Image not found" }, 404);

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  headers.set("cache-control", "public, max-age=31536000, immutable");

  return new Response(object.body, { headers });
});

// ─── Outfits ──────────────────────────────────────────────────────────────────

app.get("/api/outfits", async (c) => {
  const { results: outfits } = await c.env.DB.prepare(
    "SELECT * FROM outfits ORDER BY created_at DESC"
  ).all<{ id: number; name: string; notes: string | null; created_at: string; updated_at: string }>();

  const outfitsWithItems = await Promise.all(
    outfits.map(async (outfit) => {
      const { results: items } = await c.env.DB.prepare(`
        SELECT i.*, c.name AS category_name
        FROM outfit_items oi
        JOIN items i ON i.id = oi.item_id
        LEFT JOIN categories c ON c.id = i.category_id
        WHERE oi.outfit_id = ?
      `)
        .bind(outfit.id)
        .all();
      return { ...outfit, items };
    })
  );

  return c.json(outfitsWithItems);
});

app.get("/api/outfits/:id", async (c) => {
  const id = Number(c.req.param("id"));
  const outfit = await c.env.DB.prepare(
    "SELECT * FROM outfits WHERE id = ?"
  )
    .bind(id)
    .first();
  if (!outfit) return c.json({ error: "Outfit not found" }, 404);

  const { results: items } = await c.env.DB.prepare(`
    SELECT i.*, c.name AS category_name
    FROM outfit_items oi
    JOIN items i ON i.id = oi.item_id
    LEFT JOIN categories c ON c.id = i.category_id
    WHERE oi.outfit_id = ?
  `)
    .bind(id)
    .all();

  return c.json({ ...outfit, items });
});

app.post("/api/outfits", async (c) => {
  const body = await c.req.json<{
    name: string;
    notes?: string;
    item_ids?: number[];
  }>();

  if (!body.name?.trim()) {
    return c.json({ error: "Outfit name is required" }, 400);
  }

  const outfit = await c.env.DB.prepare(
    "INSERT INTO outfits (name, notes) VALUES (?, ?) RETURNING *"
  )
    .bind(body.name.trim(), body.notes ?? null)
    .first<{ id: number }>();

  if (outfit && body.item_ids?.length) {
    const stmts = body.item_ids.map((itemId) =>
      c.env.DB.prepare(
        "INSERT OR IGNORE INTO outfit_items (outfit_id, item_id) VALUES (?, ?)"
      ).bind(outfit.id, itemId)
    );
    await c.env.DB.batch(stmts);
  }

  return c.json(outfit, 201);
});

app.put("/api/outfits/:id", async (c) => {
  const id = Number(c.req.param("id"));
  const body = await c.req.json<{
    name?: string;
    notes?: string;
    item_ids?: number[];
  }>();

  const existing = await c.env.DB.prepare(
    "SELECT * FROM outfits WHERE id = ?"
  )
    .bind(id)
    .first<{ name: string; notes: string | null }>();

  if (!existing) return c.json({ error: "Outfit not found" }, 404);

  const updated = await c.env.DB.prepare(`
    UPDATE outfits
    SET name = ?, notes = ?, updated_at = datetime('now')
    WHERE id = ?
    RETURNING *
  `)
    .bind(body.name ?? existing.name, body.notes ?? existing.notes, id)
    .first();

  if (body.item_ids !== undefined) {
    await c.env.DB.prepare(
      "DELETE FROM outfit_items WHERE outfit_id = ?"
    )
      .bind(id)
      .run();

    if (body.item_ids.length) {
      const stmts = body.item_ids.map((itemId) =>
        c.env.DB.prepare(
          "INSERT OR IGNORE INTO outfit_items (outfit_id, item_id) VALUES (?, ?)"
        ).bind(id, itemId)
      );
      await c.env.DB.batch(stmts);
    }
  }

  return c.json(updated);
});

app.delete("/api/outfits/:id", async (c) => {
  const id = Number(c.req.param("id"));
  await c.env.DB.prepare("DELETE FROM outfits WHERE id = ?").bind(id).run();
  return c.json({ success: true });
});

// ─── Static assets (production) ──────────────────────────────────────────────

app.use("/*", serveStatic({ root: "./" }));

export default app;
