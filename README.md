# My Kitchen — инструкция по запуску

1. Создайте бесплатный проект на supabase.com.
2. SQL Editor → вставьте содержимое `supabase/schema.sql` → Run (таблицы, защита RLS, закрытое хранилище фото).
3. Project Settings → API: скопируйте Project URL и anon public key. Ключ service_role НЕ используйте.
4. Скопируйте `.env.example` в `.env` и вставьте значения.
5. Локально: `npm install`, затем `npm run dev`.
6. Публикация: загрузите папку на GitHub → vercel.com → Import → в Environment Variables добавьте VITE_SUPABASE_URL и VITE_SUPABASE_ANON_KEY → Deploy.
7. iPhone: откройте ссылку в Safari → «Поделиться» → «На экран Домой».
