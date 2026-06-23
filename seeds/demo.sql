-- seeds/demo.sql
-- Demo items so a fresh KLZT install has something to render.
--
-- Safe to re-run: stable IDs + INSERT OR REPLACE overwrite existing
-- demo rows with the current contents of this file. Wipe with
-- `DELETE FROM items WHERE id LIKE 'demo-%';`
--
-- Images use placehold.co branded cards so the gallery reads as
-- "closet items" instead of random stock photos.
--
-- Magic Fix end-to-end demo: demo-09 points raw_image_url at the
-- Worker R2 proxy. Run `npm run seed:r2:local` (or seed:r2:remote)
-- to upload the matching raw/items/demo-09.jpg into R2 — after that,
-- clicking "Magic Fix" on demo-09 copies raw -> processed and flips
-- status to ready. The other demo rows are read-only previews.

INSERT OR REPLACE INTO items
  (id, created_at, sort_order, raw_image_url, processed_image_url, status, metadata)
VALUES
  ('demo-01', unixepoch() - 8 * 3600, 0,
   'https://placehold.co/600x600/f5f5f5/222222/png?text=Uniqlo%0AWhite+Tee&font=inter',
   'https://placehold.co/600x600/f5f5f5/222222/png?text=Uniqlo%0AWhite+Tee&font=inter',
   'ready',
   '{"brand":"Uniqlo","item_type":"T-shirt","color":"White","season":"All"}'),

  ('demo-02', unixepoch() - 7 * 3600, 1,
   'https://placehold.co/600x600/1f3a5f/ffffff/png?text=Levi%27s%0ADenim+Jacket&font=inter',
   'https://placehold.co/600x600/1f3a5f/ffffff/png?text=Levi%27s%0ADenim+Jacket&font=inter',
   'ready',
   '{"brand":"Levi''s","item_type":"Jacket","color":"Indigo","material":"Denim","season":"Spring"}'),

  ('demo-03', unixepoch() - 6 * 3600, 2,
   'https://placehold.co/600x600/111111/ffffff/png?text=Nike%0ABlack+Sneakers&font=inter',
   'https://placehold.co/600x600/111111/ffffff/png?text=Nike%0ABlack+Sneakers&font=inter',
   'ready',
   '{"brand":"Nike","item_type":"Sneakers","color":"Black","occasion":"Casual"}'),

  ('demo-04', unixepoch() - 5 * 3600, 3,
   'https://placehold.co/600x600/d6c19c/3a2e1c/png?text=Burberry%0ATrench+Coat&font=inter',
   'https://placehold.co/600x600/d6c19c/3a2e1c/png?text=Burberry%0ATrench+Coat&font=inter',
   'ready',
   '{"brand":"Burberry","item_type":"Trench","color":"Beige","season":"Fall"}'),

  ('demo-05', unixepoch() - 4 * 3600, 4,
   'https://placehold.co/600x600/1a2a44/f7e7ce/png?text=J.Crew%0AStriped+Sweater&font=inter',
   'https://placehold.co/600x600/1a2a44/f7e7ce/png?text=J.Crew%0AStriped+Sweater&font=inter',
   'ready',
   '{"brand":"J.Crew","item_type":"Sweater","pattern":"Stripe","color":"Navy/Cream","season":"Winter"}'),

  ('demo-06', unixepoch() - 3 * 3600, 5,
   'https://placehold.co/600x600/2b3b5e/ffffff/png?text=A.P.C.%0ASelvedge+Jeans&font=inter',
   'https://placehold.co/600x600/2b3b5e/ffffff/png?text=A.P.C.%0ASelvedge+Jeans&font=inter',
   'ready',
   '{"brand":"A.P.C.","item_type":"Jeans","fit":"Slim","material":"Selvedge denim"}'),

  ('demo-07', unixepoch() - 2 * 3600, 6,
   'https://placehold.co/600x600/4d5a3a/ffffff/png?text=Carhartt%0AOlive+Cargos&font=inter',
   'https://placehold.co/600x600/4d5a3a/ffffff/png?text=Carhartt%0AOlive+Cargos&font=inter',
   'ready',
   '{"brand":"Carhartt","item_type":"Cargo pants","color":"Olive","fit":"Relaxed"}'),

  ('demo-08', unixepoch() - 1 * 3600, 7,
   'https://placehold.co/600x600/3a1f17/ffffff/png?text=Madewell%0ALeather+Belt&font=inter',
   'https://placehold.co/600x600/3a1f17/ffffff/png?text=Madewell%0ALeather+Belt&font=inter',
   'ready',
   '{"brand":"Madewell","item_type":"Belt","color":"Black","material":"Leather"}'),

  -- One raw item backed by a real R2 object (uploaded by
  -- seeds/upload-r2.sh). Clicking "Magic Fix" on this row exercises
  -- the full raw -> processed copy + status transition.
  ('demo-09', unixepoch() - 30 * 60, 8,
   '/api/r2/raw/items/demo-09.jpg',
   NULL,
   'raw',
   '{"brand":"Acne Studios","item_type":"Scarf","color":"Charcoal"}');
