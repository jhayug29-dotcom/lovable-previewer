-- Seed catalog (safe to re-run)

insert into public.products (slug,title,tagline,description,category,cover_url,video_url,price,original_price,is_free,badge,features,file_info,how_to_use,rating,sales,active,sort_order) values (
  'aurora-motion-pack', 'Aurora Motion Pack', '120 cinematic After Effects transitions & titles', 'Aurora is a fully modular motion system built for editors who ship fast. Every transition, title and overlay is pre-composed with a single control layer, so you can restyle an entire sequence in seconds without touching keyframes.', 'After Effects', '/dev-server/src/assets/cover-ae.jpg', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4',
  1499, 3999, false, 'Bestseller',
  array['120 drag-and-drop transitions','48 animated title scenes','One-click color control rig','Lifetime free updates']::text[], array['After Effects CC 2020+','4K / 60fps','2.8 GB','No plugins']::text[], '[{"step":"Download & unzip","detail":"Extract the pack anywhere on your drive — no installer needed."},{"step":"Open the master project","detail":"Launch Aurora_Master.aep in After Effects CC 2020 or newer."},{"step":"Drag a preset in","detail":"Pull any composition onto your timeline and it snaps to your footage."},{"step":"Restyle instantly","detail":"Use the Control layer to change color, speed and grain globally."}]'::jsonb, 4.9, 3120, true, 0)
on conflict (slug) do nothing;
insert into public.reviews (product_id,name,handle,rating,body)
  select id, 'Aarav Mehta', '@aaravcuts', 5, 'Cut my edit time in half. The control rig alone is worth the price.' from public.products where slug = 'aurora-motion-pack'
  and not exists (select 1 from public.reviews rv join public.products pr on pr.id = rv.product_id where pr.slug = 'aurora-motion-pack' and rv.name = 'Aarav Mehta' and rv.body = 'Cut my edit time in half. The control rig alone is worth the price.');
insert into public.reviews (product_id,name,handle,rating,body)
  select id, 'Lena Fischer', '@lenagrade', 5, 'Cleanest AE pack I have bought. Renders fast and nothing breaks.' from public.products where slug = 'aurora-motion-pack'
  and not exists (select 1 from public.reviews rv join public.products pr on pr.id = rv.product_id where pr.slug = 'aurora-motion-pack' and rv.name = 'Lena Fischer' and rv.body = 'Cleanest AE pack I have bought. Renders fast and nothing breaks.');
insert into public.reviews (product_id,name,handle,rating,body)
  select id, 'Diego Ruiz', '@diegomotion', 4, 'Great value. Would love a few more vertical presets for reels.' from public.products where slug = 'aurora-motion-pack'
  and not exists (select 1 from public.reviews rv join public.products pr on pr.id = rv.product_id where pr.slug = 'aurora-motion-pack' and rv.name = 'Diego Ruiz' and rv.body = 'Great value. Would love a few more vertical presets for reels.');

insert into public.products (slug,title,tagline,description,category,cover_url,video_url,price,original_price,is_free,badge,features,file_info,how_to_use,rating,sales,active,sort_order) values (
  'halcyon-lut-collection', 'Halcyon LUT Collection', '60 film-emulation LUTs graded on real scans', 'Halcyon is built from scanned film stocks and hand-balanced for digital sensors. Each LUT ships in Rec.709 and Log variants so your grade holds up whether you shoot on a phone or a cinema camera.', 'LUTs', '/dev-server/src/assets/cover-luts.jpg', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
  899, 2499, false, 'New drop',
  array['60 LUTs in .cube format','Rec.709 and Log variants','Premiere, DaVinci, FCP, AE ready','Skin-tone safe roll-off']::text[], array['.cube 33pt','Rec.709 + Log','180 MB','Works everywhere']::text[], '[{"step":"Pick your variant","detail":"Use the Log folder for flat footage, Rec.709 for standard profiles."},{"step":"Load into your NLE","detail":"Apply as a Lumetri / Color Space Transform LUT on an adjustment layer."},{"step":"Balance first","detail":"Set exposure and white balance before the LUT for the cleanest result."},{"step":"Dial the intensity","detail":"Drop opacity to 60–80% for a subtle, premium look."}]'::jsonb, 4.8, 2410, true, 1)
on conflict (slug) do nothing;
insert into public.reviews (product_id,name,handle,rating,body)
  select id, 'Priya Nair', '@priyashoots', 5, 'Skin tones stay perfect. These are not the usual orange-teal presets.' from public.products where slug = 'halcyon-lut-collection'
  and not exists (select 1 from public.reviews rv join public.products pr on pr.id = rv.product_id where pr.slug = 'halcyon-lut-collection' and rv.name = 'Priya Nair' and rv.body = 'Skin tones stay perfect. These are not the usual orange-teal presets.');
insert into public.reviews (product_id,name,handle,rating,body)
  select id, 'Marcus Hale', '@halefilms', 5, 'Used the Log set on a client doc and delivered same day. Superb.' from public.products where slug = 'halcyon-lut-collection'
  and not exists (select 1 from public.reviews rv join public.products pr on pr.id = rv.product_id where pr.slug = 'halcyon-lut-collection' and rv.name = 'Marcus Hale' and rv.body = 'Used the Log set on a client doc and delivered same day. Superb.');

insert into public.products (slug,title,tagline,description,category,cover_url,video_url,price,original_price,is_free,badge,features,file_info,how_to_use,rating,sales,active,sort_order) values (
  'flowdeck-extension', 'Flowdeck Extension', 'A control deck panel for Premiere & After Effects', 'Flowdeck puts your whole workflow into one floating panel: batch renames, proxy generation, preset libraries and instant exports. It docks anywhere and remembers your layout per project.', 'Extensions', '/dev-server/src/assets/cover-extension.jpg', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
  1999, 4999, false, null,
  array['Batch rename & organise','One-click proxy pipeline','Searchable preset library','Free updates for 12 months']::text[], array['CEP extension','Win + macOS','40 MB','Auto-updates']::text[], '[{"step":"Run the installer","detail":"Pick the installer for macOS or Windows and follow the prompts."},{"step":"Restart your host app","detail":"Flowdeck appears under Window → Extensions."},{"step":"Dock the panel","detail":"Drag it beside your Effect Controls for the fastest workflow."},{"step":"Sync your presets","detail":"Point Flowdeck at any folder to index it into the library."}]'::jsonb, 4.9, 1180, true, 2)
on conflict (slug) do nothing;
insert into public.reviews (product_id,name,handle,rating,body)
  select id, 'Tanvi Shah', '@tanviedits', 5, 'The proxy pipeline saved my 4K wedding project. Instant buy.' from public.products where slug = 'flowdeck-extension'
  and not exists (select 1 from public.reviews rv join public.products pr on pr.id = rv.product_id where pr.slug = 'flowdeck-extension' and rv.name = 'Tanvi Shah' and rv.body = 'The proxy pipeline saved my 4K wedding project. Instant buy.');
insert into public.reviews (product_id,name,handle,rating,body)
  select id, 'Yusuf Demir', '@yusufpost', 5, 'Feels like a native Adobe panel. Very polished.' from public.products where slug = 'flowdeck-extension'
  and not exists (select 1 from public.reviews rv join public.products pr on pr.id = rv.product_id where pr.slug = 'flowdeck-extension' and rv.name = 'Yusuf Demir' and rv.body = 'Feels like a native Adobe panel. Very polished.');

insert into public.products (slug,title,tagline,description,category,cover_url,video_url,price,original_price,is_free,badge,features,file_info,how_to_use,rating,sales,active,sort_order) values (
  'signal-sfx-pack', 'Signal SFX Pack', '800 designed sound effects for modern edits', 'Signal is a designed sound library — whooshes, risers, UI clicks, impacts and textures — all loudness matched and tagged so you can drop them straight onto a timeline without EQ work.', 'SFX Packs', '/dev-server/src/assets/cover-sfx.jpg', null,
  1199, 2999, false, 'Editor favourite',
  array['800 royalty-free WAV files','Loudness matched at -16 LUFS','Tagged and folder-sorted','Commercial licence included']::text[], array['WAV 48kHz/24-bit','800 files','1.4 GB','Royalty free']::text[], '[{"step":"Unzip the library","detail":"Keep the folder structure so tags stay searchable."},{"step":"Index in your NLE","detail":"Add the folder to your media browser or Soundly library."},{"step":"Search by intent","detail":"Filenames use plain words like riser, click, impact, texture."},{"step":"Layer for depth","detail":"Stack a texture under any impact for a cinematic finish."}]'::jsonb, 4.7, 1960, true, 3)
on conflict (slug) do nothing;
insert into public.reviews (product_id,name,handle,rating,body)
  select id, 'Rohan Gupta', '@rohansound', 5, 'Loudness matching is the detail nobody else gets right. Love it.' from public.products where slug = 'signal-sfx-pack'
  and not exists (select 1 from public.reviews rv join public.products pr on pr.id = rv.product_id where pr.slug = 'signal-sfx-pack' and rv.name = 'Rohan Gupta' and rv.body = 'Loudness matching is the detail nobody else gets right. Love it.');
insert into public.reviews (product_id,name,handle,rating,body)
  select id, 'Amelie Roux', '@amelieedits', 4, 'Huge library, great quality. Wish there were more sub drops.' from public.products where slug = 'signal-sfx-pack'
  and not exists (select 1 from public.reviews rv join public.products pr on pr.id = rv.product_id where pr.slug = 'signal-sfx-pack' and rv.name = 'Amelie Roux' and rv.body = 'Huge library, great quality. Wish there were more sub drops.');
