-- seeds/closet.sql
-- Real closet photos from seeds/klzt-seed-pic/.
--
-- Generated to mirror the demo-09 pattern: each row points raw_image_url
-- at the Worker R2 proxy and starts at status='raw' so the Magic Fix flow
-- (POST /api/items/seed-XXXX/process) runs end-to-end against real images.
--
-- Pair handling: IMG_3769/3770 and IMG_3786/3787 were photographed front
-- and back. The back-side URL is stashed in metadata.back_image_url so
-- two photos collapse to one entry (the front).
--
-- Run with `npm run db:seed:closet:local` (or :remote). Pair with
-- `npm run seed:r2:local` (or :remote) which uploads the jpeg files at
-- the matching R2 keys.
--
-- Safe to re-run: INSERT OR REPLACE keys off the stable `seed-NNNN` id.
-- Wipe with `DELETE FROM items WHERE id LIKE 'seed-%';`.

-- 91 rows
INSERT OR REPLACE INTO items
  (id, created_at, sort_order, raw_image_url, processed_image_url, status, metadata)
VALUES
  ('seed-3752', unixepoch(), 100, '/api/r2/raw/items/seed-3752.jpg', NULL, 'raw', NULL),
  ('seed-3753', unixepoch(), 101, '/api/r2/raw/items/seed-3753.jpg', NULL, 'raw', NULL),
  ('seed-3754', unixepoch(), 102, '/api/r2/raw/items/seed-3754.jpg', NULL, 'raw', NULL),
  ('seed-3755', unixepoch(), 103, '/api/r2/raw/items/seed-3755.jpg', NULL, 'raw', NULL),
  ('seed-3756', unixepoch(), 104, '/api/r2/raw/items/seed-3756.jpg', NULL, 'raw', NULL),
  ('seed-3757', unixepoch(), 105, '/api/r2/raw/items/seed-3757.jpg', NULL, 'raw', NULL),
  ('seed-3758', unixepoch(), 106, '/api/r2/raw/items/seed-3758.jpg', NULL, 'raw', NULL),
  ('seed-3759', unixepoch(), 107, '/api/r2/raw/items/seed-3759.jpg', NULL, 'raw', NULL),
  ('seed-3760', unixepoch(), 108, '/api/r2/raw/items/seed-3760.jpg', NULL, 'raw', NULL),
  ('seed-3761', unixepoch(), 109, '/api/r2/raw/items/seed-3761.jpg', NULL, 'raw', NULL),
  ('seed-3762', unixepoch(), 110, '/api/r2/raw/items/seed-3762.jpg', NULL, 'raw', NULL),
  ('seed-3763', unixepoch(), 111, '/api/r2/raw/items/seed-3763.jpg', NULL, 'raw', NULL),
  ('seed-3764', unixepoch(), 112, '/api/r2/raw/items/seed-3764.jpg', NULL, 'raw', NULL),
  ('seed-3765', unixepoch(), 113, '/api/r2/raw/items/seed-3765.jpg', NULL, 'raw', NULL),
  ('seed-3766', unixepoch(), 114, '/api/r2/raw/items/seed-3766.jpg', NULL, 'raw', NULL),
  ('seed-3767', unixepoch(), 115, '/api/r2/raw/items/seed-3767.jpg', NULL, 'raw', NULL),
  ('seed-3768', unixepoch(), 116, '/api/r2/raw/items/seed-3768.jpg', NULL, 'raw', NULL),
  ('seed-3769', unixepoch(), 117, '/api/r2/raw/items/seed-3769.jpg', NULL, 'raw', '{"back_image_url": "/api/r2/raw/items/seed-3770.jpg"}'),
  ('seed-3771', unixepoch(), 118, '/api/r2/raw/items/seed-3771.jpg', NULL, 'raw', NULL),
  ('seed-3772', unixepoch(), 119, '/api/r2/raw/items/seed-3772.jpg', NULL, 'raw', NULL),
  ('seed-3773', unixepoch(), 120, '/api/r2/raw/items/seed-3773.jpg', NULL, 'raw', NULL),
  ('seed-3774', unixepoch(), 121, '/api/r2/raw/items/seed-3774.jpg', NULL, 'raw', NULL),
  ('seed-3775', unixepoch(), 122, '/api/r2/raw/items/seed-3775.jpg', NULL, 'raw', NULL),
  ('seed-3776', unixepoch(), 123, '/api/r2/raw/items/seed-3776.jpg', NULL, 'raw', NULL),
  ('seed-3777', unixepoch(), 124, '/api/r2/raw/items/seed-3777.jpg', NULL, 'raw', NULL),
  ('seed-3778', unixepoch(), 125, '/api/r2/raw/items/seed-3778.jpg', NULL, 'raw', NULL),
  ('seed-3779', unixepoch(), 126, '/api/r2/raw/items/seed-3779.jpg', NULL, 'raw', NULL),
  ('seed-3780', unixepoch(), 127, '/api/r2/raw/items/seed-3780.jpg', NULL, 'raw', NULL),
  ('seed-3781', unixepoch(), 128, '/api/r2/raw/items/seed-3781.jpg', NULL, 'raw', NULL),
  ('seed-3782', unixepoch(), 129, '/api/r2/raw/items/seed-3782.jpg', NULL, 'raw', NULL),
  ('seed-3783', unixepoch(), 130, '/api/r2/raw/items/seed-3783.jpg', NULL, 'raw', NULL),
  ('seed-3785', unixepoch(), 131, '/api/r2/raw/items/seed-3785.jpg', NULL, 'raw', NULL),
  ('seed-3786', unixepoch(), 132, '/api/r2/raw/items/seed-3786.jpg', NULL, 'raw', '{"back_image_url": "/api/r2/raw/items/seed-3787.jpg"}'),
  ('seed-3788', unixepoch(), 133, '/api/r2/raw/items/seed-3788.jpg', NULL, 'raw', NULL),
  ('seed-3789', unixepoch(), 134, '/api/r2/raw/items/seed-3789.jpg', NULL, 'raw', NULL),
  ('seed-3790', unixepoch(), 135, '/api/r2/raw/items/seed-3790.jpg', NULL, 'raw', NULL),
  ('seed-3791', unixepoch(), 136, '/api/r2/raw/items/seed-3791.jpg', NULL, 'raw', NULL),
  ('seed-3792', unixepoch(), 137, '/api/r2/raw/items/seed-3792.jpg', NULL, 'raw', NULL),
  ('seed-3794', unixepoch(), 138, '/api/r2/raw/items/seed-3794.jpg', NULL, 'raw', NULL),
  ('seed-3795', unixepoch(), 139, '/api/r2/raw/items/seed-3795.jpg', NULL, 'raw', NULL),
  ('seed-3796', unixepoch(), 140, '/api/r2/raw/items/seed-3796.jpg', NULL, 'raw', NULL),
  ('seed-3797', unixepoch(), 141, '/api/r2/raw/items/seed-3797.jpg', NULL, 'raw', NULL),
  ('seed-3798', unixepoch(), 142, '/api/r2/raw/items/seed-3798.jpg', NULL, 'raw', NULL),
  ('seed-3799', unixepoch(), 143, '/api/r2/raw/items/seed-3799.jpg', NULL, 'raw', NULL),
  ('seed-3800', unixepoch(), 144, '/api/r2/raw/items/seed-3800.jpg', NULL, 'raw', NULL),
  ('seed-3801', unixepoch(), 145, '/api/r2/raw/items/seed-3801.jpg', NULL, 'raw', NULL),
  ('seed-3802', unixepoch(), 146, '/api/r2/raw/items/seed-3802.jpg', NULL, 'raw', NULL),
  ('seed-3803', unixepoch(), 147, '/api/r2/raw/items/seed-3803.jpg', NULL, 'raw', NULL),
  ('seed-3804', unixepoch(), 148, '/api/r2/raw/items/seed-3804.jpg', NULL, 'raw', NULL),
  ('seed-3805', unixepoch(), 149, '/api/r2/raw/items/seed-3805.jpg', NULL, 'raw', NULL),
  ('seed-3806', unixepoch(), 150, '/api/r2/raw/items/seed-3806.jpg', NULL, 'raw', NULL),
  ('seed-3807', unixepoch(), 151, '/api/r2/raw/items/seed-3807.jpg', NULL, 'raw', NULL),
  ('seed-3808', unixepoch(), 152, '/api/r2/raw/items/seed-3808.jpg', NULL, 'raw', NULL),
  ('seed-3809', unixepoch(), 153, '/api/r2/raw/items/seed-3809.jpg', NULL, 'raw', NULL),
  ('seed-3811', unixepoch(), 154, '/api/r2/raw/items/seed-3811.jpg', NULL, 'raw', NULL),
  ('seed-3812', unixepoch(), 155, '/api/r2/raw/items/seed-3812.jpg', NULL, 'raw', NULL),
  ('seed-3813', unixepoch(), 156, '/api/r2/raw/items/seed-3813.jpg', NULL, 'raw', NULL),
  ('seed-3814', unixepoch(), 157, '/api/r2/raw/items/seed-3814.jpg', NULL, 'raw', NULL),
  ('seed-3815', unixepoch(), 158, '/api/r2/raw/items/seed-3815.jpg', NULL, 'raw', NULL),
  ('seed-3816', unixepoch(), 159, '/api/r2/raw/items/seed-3816.jpg', NULL, 'raw', NULL),
  ('seed-3817', unixepoch(), 160, '/api/r2/raw/items/seed-3817.jpg', NULL, 'raw', NULL),
  ('seed-3818', unixepoch(), 161, '/api/r2/raw/items/seed-3818.jpg', NULL, 'raw', NULL),
  ('seed-3820', unixepoch(), 162, '/api/r2/raw/items/seed-3820.jpg', NULL, 'raw', NULL),
  ('seed-3821', unixepoch(), 163, '/api/r2/raw/items/seed-3821.jpg', NULL, 'raw', NULL),
  ('seed-3822', unixepoch(), 164, '/api/r2/raw/items/seed-3822.jpg', NULL, 'raw', NULL),
  ('seed-3823', unixepoch(), 165, '/api/r2/raw/items/seed-3823.jpg', NULL, 'raw', NULL),
  ('seed-3824', unixepoch(), 166, '/api/r2/raw/items/seed-3824.jpg', NULL, 'raw', NULL),
  ('seed-3825', unixepoch(), 167, '/api/r2/raw/items/seed-3825.jpg', NULL, 'raw', NULL),
  ('seed-3826', unixepoch(), 168, '/api/r2/raw/items/seed-3826.jpg', NULL, 'raw', NULL),
  ('seed-3827', unixepoch(), 169, '/api/r2/raw/items/seed-3827.jpg', NULL, 'raw', NULL),
  ('seed-3828', unixepoch(), 170, '/api/r2/raw/items/seed-3828.jpg', NULL, 'raw', NULL),
  ('seed-3829', unixepoch(), 171, '/api/r2/raw/items/seed-3829.jpg', NULL, 'raw', NULL),
  ('seed-3830', unixepoch(), 172, '/api/r2/raw/items/seed-3830.jpg', NULL, 'raw', NULL),
  ('seed-3831', unixepoch(), 173, '/api/r2/raw/items/seed-3831.jpg', NULL, 'raw', NULL),
  ('seed-3832', unixepoch(), 174, '/api/r2/raw/items/seed-3832.jpg', NULL, 'raw', NULL),
  ('seed-3833', unixepoch(), 175, '/api/r2/raw/items/seed-3833.jpg', NULL, 'raw', NULL),
  ('seed-3834', unixepoch(), 176, '/api/r2/raw/items/seed-3834.jpg', NULL, 'raw', NULL),
  ('seed-3835', unixepoch(), 177, '/api/r2/raw/items/seed-3835.jpg', NULL, 'raw', NULL),
  ('seed-3836', unixepoch(), 178, '/api/r2/raw/items/seed-3836.jpg', NULL, 'raw', NULL),
  ('seed-3837', unixepoch(), 179, '/api/r2/raw/items/seed-3837.jpg', NULL, 'raw', NULL),
  ('seed-3838', unixepoch(), 180, '/api/r2/raw/items/seed-3838.jpg', NULL, 'raw', NULL),
  ('seed-3839', unixepoch(), 181, '/api/r2/raw/items/seed-3839.jpg', NULL, 'raw', NULL),
  ('seed-3840', unixepoch(), 182, '/api/r2/raw/items/seed-3840.jpg', NULL, 'raw', NULL),
  ('seed-3841', unixepoch(), 183, '/api/r2/raw/items/seed-3841.jpg', NULL, 'raw', NULL),
  ('seed-3842', unixepoch(), 184, '/api/r2/raw/items/seed-3842.jpg', NULL, 'raw', NULL),
  ('seed-3843', unixepoch(), 185, '/api/r2/raw/items/seed-3843.jpg', NULL, 'raw', NULL),
  ('seed-3844', unixepoch(), 186, '/api/r2/raw/items/seed-3844.jpg', NULL, 'raw', NULL),
  ('seed-3845', unixepoch(), 187, '/api/r2/raw/items/seed-3845.jpg', NULL, 'raw', NULL),
  ('seed-3846', unixepoch(), 188, '/api/r2/raw/items/seed-3846.jpg', NULL, 'raw', NULL),
  ('seed-3847', unixepoch(), 189, '/api/r2/raw/items/seed-3847.jpg', NULL, 'raw', NULL),
  ('seed-3848', unixepoch(), 190, '/api/r2/raw/items/seed-3848.jpg', NULL, 'raw', NULL);
