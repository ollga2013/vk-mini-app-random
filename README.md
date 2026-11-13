# VK Winner Mini App

Мини-приложение для подведения итогов конкурсов VK.

## Что делает

- импортирует участников из VK API;
- проверяет репост, комментарий, лайк;
- выбирает одного или нескольких победителей;
- поддерживает призы по местам;
- экспортирует текст и PNG с итогами.

## Backend

Backend уже встроен в `server.js`.

Он нужен, чтобы не хранить токены и важную логику во frontend. Сам HTML/JS все равно скачивается браузером, но без backend он остается только оболочкой.

Защита включается через `VK_APP_SECRET`: тогда `/api/import` и `/api/enrich` принимают запросы только с валидными VK launch params.

## Локальный запуск

```powershell
copy .env.example .env.local
node server.js
```

Открыть:

```text
http://127.0.0.1:4173
```

## Переменные окружения

```env
VK_USER_TOKEN=
VK_SERVICE_TOKEN=
VK_APP_SECRET=
VK_API_VERSION=5.199
VK_IMPORT_SCAN_DEPTH=60
VK_IMPORT_MAX_ITEMS=50000
VK_LAUNCH_MAX_AGE_SECONDS=86400
PORT=4173
```

`VK_SERVICE_TOKEN` и `VK_USER_TOKEN` хранятся только на сервере.

`VK_APP_SECRET` берется из настроек VK приложения. Не публиковать.

## Отдельный backend-домен

Если frontend лежит на VK Hosting, а backend на другом домене, укажи URL перед `app.js` в `index.html`:

```html
<script>
  window.VK_WINNER_API_BASE_URL = "https://your-backend.example.com";
</script>
```

Если frontend и backend на одном домене, оставь пустую строку.

## API

- `GET /api/status` - статус токенов и backend.
- `POST /api/import` - импорт участников.
- `POST /api/enrich` - серверная допроверка участников.
- `GET /api/image?url=...` - proxy аватаров для PNG.

## Важно

- frontend нельзя полностью скрыть от скачивания;
- секреты нельзя класть в `app.js`;
- важные проверки держать в `server.js`;
- включить `VK_APP_SECRET` на production.
