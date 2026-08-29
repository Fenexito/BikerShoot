-- ============================================================
-- SEED DE PRUEBA — fotógrafos, bikers y eventos de mentira
-- ============================================================
-- Ejecutar UNA VEZ en el SQL Editor de Supabase.
--
-- Crea 3 cuentas de fotógrafo y 3 cuentas de biker REALES (con
-- contraseña conocida, ya confirmadas) para que puedas iniciar
-- sesión y subir fotos de prueba sin usar tus propios correos.
-- También crea 9 eventos con sus puntos de cobertura, repartidos
-- entre los 3 fotógrafos.
--
-- Contraseña de TODAS las cuentas de prueba: TestDev123!
--
-- Para borrar TODO lo de esta prueba más adelante (cascada
-- automática hasta perfiles, eventos, puntos y fotos que hayas
-- subido con estas cuentas), corre esto:
--
--   delete from auth.users where email like '%@test.motoshots.dev';
--
-- ============================================================

create extension if not exists pgcrypto;

do $$
declare
  photographer1 uuid := gen_random_uuid();
  photographer2 uuid := gen_random_uuid();
  photographer3 uuid := gen_random_uuid();
  biker1 uuid := gen_random_uuid();
  biker2 uuid := gen_random_uuid();
  biker3 uuid := gen_random_uuid();
  event_id uuid;
begin

  -- ---------- Crear las 6 cuentas (dispara el trigger handle_new_user) ----------
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, email_change, email_change_token_new, recovery_token
  ) values
    ('00000000-0000-0000-0000-000000000000', photographer1, 'authenticated', 'authenticated', 'dev-photographer-1@test.motoshots.dev', crypt('TestDev123!', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', jsonb_build_object('role','photographer','display_name','TEST — Foto Norte'), now(), now(), '', '', '', ''),
    ('00000000-0000-0000-0000-000000000000', photographer2, 'authenticated', 'authenticated', 'dev-photographer-2@test.motoshots.dev', crypt('TestDev123!', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', jsonb_build_object('role','photographer','display_name','TEST — Foto Antigua'), now(), now(), '', '', '', ''),
    ('00000000-0000-0000-0000-000000000000', photographer3, 'authenticated', 'authenticated', 'dev-photographer-3@test.motoshots.dev', crypt('TestDev123!', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', jsonb_build_object('role','photographer','display_name','TEST — Foto Pacífico'), now(), now(), '', '', '', ''),
    ('00000000-0000-0000-0000-000000000000', biker1, 'authenticated', 'authenticated', 'dev-biker-1@test.motoshots.dev', crypt('TestDev123!', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', jsonb_build_object('role','biker','display_name','TEST Biker Uno'), now(), now(), '', '', '', ''),
    ('00000000-0000-0000-0000-000000000000', biker2, 'authenticated', 'authenticated', 'dev-biker-2@test.motoshots.dev', crypt('TestDev123!', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', jsonb_build_object('role','biker','display_name','TEST Biker Dos'), now(), now(), '', '', '', ''),
    ('00000000-0000-0000-0000-000000000000', biker3, 'authenticated', 'authenticated', 'dev-biker-3@test.motoshots.dev', crypt('TestDev123!', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', jsonb_build_object('role','biker','display_name','TEST Biker Tres'), now(), now(), '', '', '', '');

  insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  select gen_random_uuid(), u.id, u.id::text, jsonb_build_object('sub', u.id::text, 'email', u.email), 'email', now(), now(), now()
  from auth.users u
  where u.id in (photographer1, photographer2, photographer3, biker1, biker2, biker3);

  -- ---------- Completar perfiles de fotógrafo (ya aprobados, sin onboarding pendiente) ----------
  update public.photographer_details set onboarding_completed = true, approved = true, approved_at = now(),
    city = 'Guatemala', whatsapp = '+502 5000 0001', bio = 'Cuenta de prueba (TEST) — fotógrafo de la zona norte.'
    where profile_id = photographer1;
  update public.photographer_details set onboarding_completed = true, approved = true, approved_at = now(),
    city = 'Antigua', whatsapp = '+502 5000 0002', bio = 'Cuenta de prueba (TEST) — fotógrafo en Antigua.'
    where profile_id = photographer2;
  update public.photographer_details set onboarding_completed = true, approved = true, approved_at = now(),
    city = 'Escuintla', whatsapp = '+502 5000 0003', bio = 'Cuenta de prueba (TEST) — cobertura ruta al Pacífico.'
    where profile_id = photographer3;

  update public.biker_details set moto_brand = 'Yamaha', moto_model = 'MT-07', city = 'Guatemala' where profile_id = biker1;
  update public.biker_details set moto_brand = 'Honda', moto_model = 'CB500X', city = 'Antigua' where profile_id = biker2;
  update public.biker_details set moto_brand = 'Kawasaki', moto_model = 'Ninja 400', city = 'Escuintla' where profile_id = biker3;

  -- ---------- Eventos + puntos: Foto Norte (Guatemala) ----------
  insert into public.events (photographer_id, title, category, city, venue, event_date, price_per_photo, description, status)
  values (photographer1, 'TEST — Rodada Nocturna Roosevelt', 'Rodada', 'Guatemala', 'Calzada Roosevelt', current_date - 3, 25, 'Evento de prueba (TEST). Cobertura de salida y ruta.', 'activo')
  returning id into event_id;
  insert into public.event_points (event_id, label, lat, lng, time_start, time_end) values
    (event_id, 'Salida — Roosevelt', 14.6134, -90.5673, '05:00', '05:30'),
    (event_id, 'Km 10 — Carretera al Pacífico', 14.5934, -90.6312, '05:30', '06:00');

  insert into public.events (photographer_id, title, category, city, venue, event_date, price_per_photo, description, status)
  values (photographer1, 'TEST — Track Day Pedro Cofiño', 'Pista', 'Guatemala', 'Autódromo Pedro Cofiño', current_date - 10, 30, 'Evento de prueba (TEST). Tandas de mañana y tarde.', 'activo')
  returning id into event_id;
  insert into public.event_points (event_id, label, lat, lng, time_start, time_end) values
    (event_id, 'Curva 4', 14.3050, -90.7850, '08:00', '10:00'),
    (event_id, 'Recta principal', 14.3070, -90.7830, '10:00', '12:00');

  insert into public.events (photographer_id, title, category, city, venue, event_date, price_per_photo, description, status)
  values (photographer1, 'TEST — Concentración Harley GT', 'Concentración', 'Guatemala', 'Parque Central', current_date + 5, 20, 'Evento de prueba (TEST). Próximo, sin fotos todavía.', 'activo')
  returning id into event_id;
  insert into public.event_points (event_id, label, lat, lng, time_start, time_end) values
    (event_id, 'Punto único — Parque Central', 14.6349, -90.5069, '09:00', '12:00');

  -- ---------- Eventos + puntos: Foto Antigua ----------
  insert into public.events (photographer_id, title, category, city, venue, event_date, price_per_photo, description, status)
  values (photographer2, 'TEST — Rodada Amanecer Antigua', 'Rodada', 'Antigua', 'Parque Central Antigua', current_date - 2, 28, 'Evento de prueba (TEST).', 'activo')
  returning id into event_id;
  insert into public.event_points (event_id, label, lat, lng, time_start, time_end) values
    (event_id, 'Salida — Parque Central', 14.5586, -90.7295, '05:30', '06:00'),
    (event_id, 'Mirador Cerro de la Cruz', 14.5657, -90.7340, '06:00', '06:30');

  insert into public.events (photographer_id, title, category, city, venue, event_date, price_per_photo, description, status)
  values (photographer2, 'TEST — Exhibición Custom Bikes Antigua', 'Exhibición', 'Antigua', 'Calle del Arco', current_date - 15, 22, 'Evento de prueba (TEST).', 'cerrado')
  returning id into event_id;
  insert into public.event_points (event_id, label, lat, lng, time_start, time_end) values
    (event_id, 'Calle del Arco', 14.5590, -90.7340, '14:00', '18:00');

  insert into public.events (photographer_id, title, category, city, venue, event_date, price_per_photo, description, status)
  values (photographer2, 'TEST — Rodada Chimaltenango-Antigua', 'Rodada', 'Chimaltenango', 'Salida CA-1', current_date + 2, 25, 'Evento de prueba (TEST).', 'activo')
  returning id into event_id;
  insert into public.event_points (event_id, label, lat, lng, time_start, time_end) values
    (event_id, 'Salida — Chimaltenango', 14.6611, -90.8207, '06:00', '06:30'),
    (event_id, 'Llegada — Antigua', 14.5586, -90.7295, '07:00', '07:30');

  -- ---------- Eventos + puntos: Foto Pacífico (Escuintla) ----------
  insert into public.events (photographer_id, title, category, city, venue, event_date, price_per_photo, description, status)
  values (photographer3, 'TEST — Rodada Amanecer en la Costa', 'Rodada', 'Escuintla', 'Ruta al Pacífico', current_date - 1, 20, 'Evento de prueba (TEST).', 'activo')
  returning id into event_id;
  insert into public.event_points (event_id, label, lat, lng, time_start, time_end) values
    (event_id, 'Salida — Km 0', 14.5842, -90.5501, '04:30', '05:00'),
    (event_id, 'Km 40 — Escuintla', 14.4917, -90.6103, '05:00', '05:30'),
    (event_id, 'Llegada — Puerto San José', 14.3050, -90.7850, '05:30', '06:00');

  insert into public.events (photographer_id, title, category, city, venue, event_date, price_per_photo, description, status)
  values (photographer3, 'TEST — Track Day Nocturno', 'Pista', 'Escuintla', 'Autódromo Pedro Cofiño', current_date - 20, 30, 'Evento de prueba (TEST).', 'cerrado')
  returning id into event_id;
  insert into public.event_points (event_id, label, lat, lng, time_start, time_end) values
    (event_id, 'Pista principal', 14.3060, -90.7840, '18:00', '21:00');

  insert into public.events (photographer_id, title, category, city, venue, event_date, price_per_photo, description, status)
  values (photographer3, 'TEST — Encuentro Sport Bikes Pacífico', 'Exhibición', 'Escuintla', 'Plaza Central', current_date + 8, 20, 'Evento de prueba (TEST). Próximo.', 'activo')
  returning id into event_id;
  insert into public.event_points (event_id, label, lat, lng, time_start, time_end) values
    (event_id, 'Plaza Central', 14.3050, -90.7850, '10:00', '13:00');

end $$;
